/**
 * Media Stream Interceptor — Background Service Worker
 * Sniffs video streams (HLS, DASH, MP4) and captures authorization/CORS headers.
 * Uses chrome.storage.session/local to persist state across Service Worker suspensions.
 */

const DEFAULT_SETTINGS = {
  webhookEnabled: false,
  webhookUrl: "",
  filterSegments: true, // Filter out .ts and .m4s fragments
  maxStreamsPerTab: 50,
};

// Safe storage selector (session storage persists across service worker shutdowns)
const storage = chrome.storage.session || chrome.storage.local;

// In-memory temporary request header cache: requestId -> headers map
const pendingHeaders = new Map();

// Initialize or load settings
async function getSettings() {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result };
}

// Media stream detection patterns
const STREAM_PATTERNS = {
  hls: /\.(m3u8)(\?.*)?$/i,
  dash: /\.(mpd)(\?.*)?$/i,
  direct: /\.(mp4|webm|mkv)(\?.*)?$/i,
  segment: /\.(ts|m4s|m4a|m4v)(\?.*)?$/i,
};

function detectStreamType(url) {
  if (STREAM_PATTERNS.hls.test(url)) return "hls";
  if (STREAM_PATTERNS.dash.test(url)) return "dash";
  if (STREAM_PATTERNS.direct.test(url)) return "direct";
  return null;
}

// Update action badge for tab
function updateBadge(tabId, count) {
  if (count > 0) {
    chrome.action.setBadgeText({ tabId, text: String(count) });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#6366F1" }); // Indigo
  } else {
    chrome.action.setBadgeText({ tabId, text: "" });
  }
}

// Storage helpers for tab streams
async function getTabStreams(tabId) {
  const key = `streams_${tabId}`;
  const res = await storage.get(key);
  return res[key] || [];
}

async function saveTabStream(tabId, streamItem, maxStreams = 50) {
  const key = `streams_${tabId}`;
  const res = await storage.get(key);
  let list = res[key] || [];

  const existingIdx = list.findIndex((item) => item.url === streamItem.url);
  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...streamItem };
  } else {
    list.unshift(streamItem); // Newest stream first
    if (list.length > maxStreams) {
      list = list.slice(0, maxStreams);
    }
  }

  await storage.set({ [key]: list });
  updateBadge(tabId, list.length);
}

async function removeTabStreams(tabId) {
  const key = `streams_${tabId}`;
  await storage.remove(key);
  updateBadge(tabId, 0);
}

// Capture request headers (Cookie, Referer, User-Agent, Origin, Authorization)
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.tabId < 0) return;

    const headers = {};
    if (details.requestHeaders) {
      for (const h of details.requestHeaders) {
        const name = h.name.toLowerCase();
        if (
          [
            "user-agent",
            "referer",
            "origin",
            "cookie",
            "authorization",
            "range",
          ].includes(name)
        ) {
          headers[h.name] = h.value;
        }
      }
    }

    pendingHeaders.set(details.requestId, headers);

    // Prune stale pending headers after 30 seconds
    setTimeout(() => {
      pendingHeaders.delete(details.requestId);
    }, 30000);
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
);

// Capture response and register media stream
chrome.webRequest.onResponseStarted.addListener(
  async (details) => {
    if (details.tabId < 0) return;

    const url = details.url;
    let streamType = detectStreamType(url);

    // Also inspect Content-Type header if extension didn't match directly
    if (!streamType && details.responseHeaders) {
      for (const h of details.responseHeaders) {
        if (h.name.toLowerCase() === "content-type") {
          const ct = (h.value || "").toLowerCase();
          if (ct.includes("application/vnd.apple.mpegurl") || ct.includes("application/x-mpegurl")) {
            streamType = "hls";
          } else if (ct.includes("application/dash+xml")) {
            streamType = "dash";
          } else if (ct.includes("video/mp4") || ct.includes("video/webm")) {
            streamType = "direct";
          }
          break;
        }
      }
    }

    if (!streamType) return;

    // Check settings for fragment filtering
    const settings = await getSettings();
    if (settings.filterSegments && STREAM_PATTERNS.segment.test(url)) {
      return;
    }

    // Retrieve captured request headers
    const headers = pendingHeaders.get(details.requestId) || {};
    pendingHeaders.delete(details.requestId);

    // Get tab metadata
    let pageTitle = "";
    let pageUrl = "";
    try {
      const tab = await chrome.tabs.get(details.tabId);
      pageTitle = tab.title || "";
      pageUrl = tab.url || "";
    } catch {
      // Tab may be gone or unavailable
    }

    const streamItem = {
      id: `${details.tabId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tabId: details.tabId,
      url,
      streamType,
      statusCode: details.statusCode,
      headers,
      pageTitle,
      pageUrl,
      timestamp: Date.now(),
    };

    await saveTabStream(details.tabId, streamItem, settings.maxStreamsPerTab);

    // Auto-forward to webhook if enabled
    if (settings.webhookEnabled && settings.webhookUrl) {
      forwardStreamToWebhook(settings.webhookUrl, streamItem);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

// Clean up state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  removeTabStreams(tabId);
});

// Webhook dispatcher helper
async function forwardStreamToWebhook(webhookUrl, streamItem) {
  if (!webhookUrl || !webhookUrl.trim()) {
    return { success: false, error: "No Webhook URL configured. Open Settings to set one." };
  }
  try {
    const payload = {
      stream_url: streamItem.url,
      stream_type: streamItem.streamType,
      headers: streamItem.headers,
      page_title: streamItem.pageTitle,
      page_url: streamItem.pageUrl,
      timestamp: streamItem.timestamp,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return { success: response.ok, status: response.status };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Runtime message handler (communication with popup and options)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_TAB_STREAMS") {
    getTabStreams(message.tabId).then((streams) => {
      sendResponse({ streams });
    });
    return true; // Keep channel open for async response
  }

  if (message.action === "CLEAR_TAB_STREAMS") {
    removeTabStreams(message.tabId).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === "TRIGGER_WEBHOOK") {
    getSettings().then((settings) => {
      const targetUrl = message.webhookUrl || settings.webhookUrl;
      forwardStreamToWebhook(targetUrl, message.streamItem).then(sendResponse);
    });
    return true;
  }

  if (message.action === "TEST_WEBHOOK") {
    const targetUrl = message.webhookUrl;
    const pingPayload = {
      ping: true,
      sender: "Media Stream Interceptor",
      timestamp: Date.now(),
    };
    fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pingPayload),
    })
      .then((res) => sendResponse({ success: res.ok, status: res.status }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
