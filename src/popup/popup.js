/**
 * Media Stream Interceptor — Popup UI Controller
 */

let currentTabId = null;
let currentStreams = [];

const elements = {
  activeTabDomain: document.getElementById("activeTabDomain"),
  streamCountText: document.getElementById("streamCountText"),
  streamsContainer: document.getElementById("streamsContainer"),
  emptyState: document.getElementById("emptyState"),
  clearBtn: document.getElementById("clearBtn"),
  optionsBtn: document.getElementById("optionsBtn"),
  toast: document.getElementById("toast"),
};

// Toast notification helper
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

// Format relative timestamp
function formatTime(timestamp) {
  const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsedSec < 5) return "just now";
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Build cURL command string
function generateCurlCommand(item) {
  let cmd = `curl -i "${item.url}"`;
  if (item.headers) {
    for (const [key, value] of Object.entries(item.headers)) {
      if (value) {
        cmd += ` \\\n  -H "${key}: ${value.replace(/"/g, '\\"')}"`;
      }
    }
  }
  return cmd;
}

// Build yt-dlp command string
function generateYtDlpCommand(item) {
  let cmd = `yt-dlp`;
  if (item.headers) {
    if (item.headers.Referer || item.headers.referer) {
      cmd += ` --referer "${item.headers.Referer || item.headers.referer}"`;
    }
    if (item.headers["User-Agent"] || item.headers["user-agent"]) {
      cmd += ` --user-agent "${item.headers["User-Agent"] || item.headers["user-agent"]}"`;
    }
    for (const [key, value] of Object.entries(item.headers)) {
      const lower = key.toLowerCase();
      if (!["referer", "user-agent"].includes(lower) && value) {
        cmd += ` --add-header "${key}:${value.replace(/"/g, '\\"')}"`;
      }
    }
  }
  cmd += ` "${item.url}"`;
  return cmd;
}

// Render stream cards
function renderStreams(streams) {
  currentStreams = streams;
  elements.streamsContainer.innerHTML = "";

  const count = streams.length;
  elements.streamCountText.textContent = `${count} stream${count === 1 ? "" : "s"} captured`;

  if (count === 0) {
    elements.emptyState.style.display = "flex";
    elements.streamsContainer.style.display = "none";
    return;
  }

  elements.emptyState.style.display = "none";
  elements.streamsContainer.style.display = "flex";

  streams.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "stream-card";

    let badgeClass = "badge-direct";
    if (item.streamType === "hls") badgeClass = "badge-hls";
    if (item.streamType === "dash") badgeClass = "badge-dash";

    const domain = (() => {
      try {
        return new URL(item.url).hostname;
      } catch {
        return "stream";
      }
    })();

    card.innerHTML = `
      <div class="card-top">
        <span class="type-badge ${badgeClass}">${item.streamType.toUpperCase()}</span>
        <span class="card-time">${formatTime(item.timestamp)}</span>
      </div>
      <div class="card-url-box" title="Click to copy URL">
        <div class="card-url-text">${escapeHtml(item.url)}</div>
      </div>
      <div class="card-actions">
        <button class="btn-action btn-copy-url" data-index="${index}">Copy URL</button>
        <button class="btn-action btn-copy-curl" data-index="${index}">cURL</button>
        <button class="btn-action btn-copy-ytdlp" data-index="${index}">yt-dlp</button>
        <button class="btn-action btn-webhook" data-index="${index}">Webhook</button>
      </div>
      <div class="headers-toggle" data-index="${index}">
        <span>▸ Inspect Headers (${Object.keys(item.headers || {}).length})</span>
      </div>
      <div class="headers-content" id="headers-${index}">
        ${renderHeadersBlock(item.headers)}
      </div>
    `;

    // Copy on URL box click
    card.querySelector(".card-url-box").addEventListener("click", () => {
      navigator.clipboard.writeText(item.url).then(() => showToast("Stream URL copied!"));
    });

    // Action button handlers
    card.querySelector(".btn-copy-url").addEventListener("click", () => {
      navigator.clipboard.writeText(item.url).then(() => showToast("Stream URL copied!"));
    });

    card.querySelector(".btn-copy-curl").addEventListener("click", () => {
      const curlCmd = generateCurlCommand(item);
      navigator.clipboard.writeText(curlCmd).then(() => showToast("cURL command copied!"));
    });

    card.querySelector(".btn-copy-ytdlp").addEventListener("click", () => {
      const ytdlpCmd = generateYtDlpCommand(item);
      navigator.clipboard.writeText(ytdlpCmd).then(() => showToast("yt-dlp command copied!"));
    });

    card.querySelector(".btn-webhook").addEventListener("click", (e) => {
      const btn = e.target;
      const originalText = btn.textContent;
      btn.textContent = "Sending...";
      btn.disabled = true;

      chrome.runtime.sendMessage(
        { action: "TRIGGER_WEBHOOK", streamItem: item },
        (res) => {
          btn.disabled = false;
          if (res && res.success) {
            btn.textContent = "Sent ✓";
            showToast("Stream forwarded to webhook!");
          } else {
            btn.textContent = "Failed ✕";
            showToast(`Webhook failed: ${res?.error || "Status " + res?.status}`);
          }
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        }
      );
    });

    // Accordion toggle
    const toggleBtn = card.querySelector(".headers-toggle");
    const headersContent = card.querySelector(`#headers-${index}`);
    toggleBtn.addEventListener("click", () => {
      const isOpen = headersContent.classList.toggle("open");
      toggleBtn.querySelector("span").textContent = `${isOpen ? "▾" : "▸"} Inspect Headers (${Object.keys(item.headers || {}).length})`;
    });

    elements.streamsContainer.appendChild(card);
  });
}

function renderHeadersBlock(headers) {
  if (!headers || Object.keys(headers).length === 0) {
    return "<div style='color: var(--text-muted);'>No headers captured</div>";
  }
  return Object.entries(headers)
    .map(
      ([k, v]) =>
        `<div><strong style="color: #a5b4fc;">${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`
    )
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Load streams for current active tab
function loadActiveTabStreams() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) return;
    const tab = tabs[0];
    currentTabId = tab.id;

    try {
      const url = new URL(tab.url || "");
      elements.activeTabDomain.textContent = url.hostname || "Active Tab";
    } catch {
      elements.activeTabDomain.textContent = "Active Tab";
    }

    chrome.runtime.sendMessage(
      { action: "GET_TAB_STREAMS", tabId: currentTabId },
      (response) => {
        if (response && Array.isArray(response.streams)) {
          renderStreams(response.streams);
        } else {
          renderStreams([]);
        }
      }
    );
  });
}

// Clear streams event
elements.clearBtn.addEventListener("click", () => {
  if (!currentTabId) return;
  chrome.runtime.sendMessage(
    { action: "CLEAR_TAB_STREAMS", tabId: currentTabId },
    () => {
      renderStreams([]);
      showToast("Cleared captured streams");
    }
  );
});

// Options button event
elements.optionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Initialize
document.addEventListener("DOMContentLoaded", loadActiveTabStreams);
