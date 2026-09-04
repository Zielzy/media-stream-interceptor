# Media Stream Interceptor

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](src/manifest.json)
[![Platform](https://img.shields.io/badge/Platform-Chromium%20%7C%20Brave%20%7C%20Edge-success.svg)](#installation)

A lightweight, developer-focused browser extension to **sniff, inspect, and extract HTTP headers** from protected HLS (`.m3u8`), DASH (`.mpd`), and direct MP4 media streams.

---

## Features

- 🎯 **Universal Stream Sniffing**: Automatically intercepts HLS playlists (`.m3u8`), DASH manifests (`.mpd`), and direct video files (`.mp4`, `.webm`) as you browse.
- 🔑 **Full Header Extraction**: Harvesters essential request headers (`User-Agent`, `Referer`, `Cookie`, `Origin`, `Authorization`) needed to bypass CORS and hotlink protections.
- ⚡ **1-Click Developer Actions**:
  - **Copy Stream URL**: Instant clipboard copy of the media source.
  - **Copy as cURL**: Generates a ready-to-run `curl` command with all authentication and referer headers attached.
  - **Copy as yt-dlp**: Generates a `yt-dlp` download command with `--referer` and `--add-header` flags preconfigured.
  - **Header Inspector**: Interactive accordion to inspect raw headers directly inside the popup.
- 🔌 **Universal Webhook Forwarder**: Automatically forward sniffed stream metadata to any local server, custom Python daemon, download worker, or media proxy.
- 🛡️ **Privacy-First & Local**: No external analytics, no tracking, and no external dependencies. Runs 100% locally in your browser.

---

## Installation

### Load Unpacked (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Zielzy/media-stream-interceptor.git
   ```
2. Open your Chromium-based browser (Chrome, Brave, Edge, Vivaldi) and navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** and select the `src/` folder of this project:
   ```text
   media-stream-interceptor/src
   ```
5. Pin the **Media Stream Interceptor** icon to your browser toolbar.

---

## Usage

1. Open any web page with an active media player (e.g., streaming sites, video hosts).
2. Start playing the video.
3. Click the **Stream Interceptor** toolbar icon:
   - The badge will display the number of media streams captured on the active tab.
   - Click **cURL** to copy the command into your terminal for testing.
   - Click **yt-dlp** to download protected video chunks directly.
   - Click **Webhook** to dispatch the stream payload to your configured server.

### Example: Generated cURL Command
```bash
curl -i "https://cdn.example.com/hls/master.m3u8" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..." \
  -H "Referer: https://streamingsite.com/watch/123" \
  -H "Origin: https://streamingsite.com" \
  -H "Cookie: session_token=abcdef123456"
```

### Example: Generated yt-dlp Command
```bash
yt-dlp \
  --referer "https://streamingsite.com/watch/123" \
  --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..." \
  --add-header "Origin:https://streamingsite.com" \
  "https://cdn.example.com/hls/master.m3u8"
```

---

## Webhook Specification

You can configure the extension to automatically forward captured streams to any local or remote HTTP endpoint (e.g., `http://localhost:8080/webhook`).

### HTTP Request
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "stream_url": "https://cdn.example.com/hls/master.m3u8",
  "stream_type": "hls",
  "headers": {
    "User-Agent": "Mozilla/5.0...",
    "Referer": "https://streamingsite.com/watch/123",
    "Origin": "https://streamingsite.com",
    "Cookie": "..."
  },
  "page_title": "Video Title — Episode 1",
  "page_url": "https://streamingsite.com/watch/123",
  "timestamp": 1725430000000
}
```

---

## Project Structure

```text
media-stream-interceptor/
├── .github/workflows/
│   └── release.yml          # GitHub Actions CI/CD release workflow
├── scripts/
│   └── package.py           # Packaging script to zip distribution
├── src/
│   ├── manifest.json        # Chrome Manifest V3
│   ├── assets/              # App icons (16px, 48px, 128px)
│   ├── background/
│   │   └── service-worker.js# Request interceptor & header harvester
│   ├── popup/
│   │   ├── popup.html       # Modern dark-theme popup
│   │   ├── popup.css        # Responsive card styles
│   │   └── popup.js         # Reactive stream viewer & action handlers
│   └── options/
│       ├── settings.html    # Webhook & sniffer preference controls
│       ├── settings.css
│       └── settings.js
├── LICENSE                  # MIT License
└── README.md
```

---

## License

This project is licensed under the [MIT License](LICENSE).
Created by **[Zielzy](https://github.com/Zielzy)**.
