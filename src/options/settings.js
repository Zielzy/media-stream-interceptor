/**
 * Media Stream Interceptor — Settings Page Controller
 */

const DEFAULT_SETTINGS = {
  webhookEnabled: false,
  webhookUrl: "",
  filterSegments: true,
  maxStreamsPerTab: 50,
};

const elements = {
  webhookEnabled: document.getElementById("webhookEnabled"),
  webhookUrl: document.getElementById("webhookUrl"),
  testWebhookBtn: document.getElementById("testWebhookBtn"),
  testResult: document.getElementById("testResult"),
  filterSegments: document.getElementById("filterSegments"),
  maxStreamsPerTab: document.getElementById("maxStreamsPerTab"),
  saveBtn: document.getElementById("saveBtn"),
  saveStatus: document.getElementById("saveStatus"),
};

// Load saved settings
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    elements.webhookEnabled.checked = Boolean(settings.webhookEnabled);
    elements.webhookUrl.value = settings.webhookUrl || DEFAULT_SETTINGS.webhookUrl;
    elements.filterSegments.checked = Boolean(settings.filterSegments);
    elements.maxStreamsPerTab.value = settings.maxStreamsPerTab || DEFAULT_SETTINGS.maxStreamsPerTab;
  });
}

// Save settings
function saveSettings() {
  const newSettings = {
    webhookEnabled: elements.webhookEnabled.checked,
    webhookUrl: elements.webhookUrl.value.trim() || DEFAULT_SETTINGS.webhookUrl,
    filterSegments: elements.filterSegments.checked,
    maxStreamsPerTab: parseInt(elements.maxStreamsPerTab.value, 10) || DEFAULT_SETTINGS.maxStreamsPerTab,
  };

  chrome.storage.sync.set(newSettings, () => {
    elements.saveStatus.textContent = "Settings saved successfully! ✓";
    elements.saveStatus.classList.add("show");
    setTimeout(() => {
      elements.saveStatus.classList.remove("show");
    }, 2500);
  });
}

// Test webhook connection
elements.testWebhookBtn.addEventListener("click", () => {
  const url = elements.webhookUrl.value.trim();
  if (!url) {
    showTestResult(false, "Please enter a valid Webhook URL first.");
    return;
  }

  elements.testWebhookBtn.disabled = true;
  elements.testWebhookBtn.textContent = "Testing...";
  elements.testResult.style.display = "none";

  chrome.runtime.sendMessage({ action: "TEST_WEBHOOK", webhookUrl: url }, (res) => {
    elements.testWebhookBtn.disabled = false;
    elements.testWebhookBtn.textContent = "Test Connection";

    if (res && res.success) {
      showTestResult(true, `Connection successful! Server responded with HTTP ${res.status}.`);
    } else {
      showTestResult(false, `Connection failed: ${res?.error || "Status " + res?.status}. Make sure the target server is running.`);
    }
  });
});

function showTestResult(isSuccess, message) {
  elements.testResult.className = `test-result ${isSuccess ? "success" : "error"}`;
  elements.testResult.textContent = message;
}

elements.saveBtn.addEventListener("click", saveSettings);
document.addEventListener("DOMContentLoaded", loadSettings);
