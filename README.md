# K1 Antigravity Monitor

[![Visual Studio Code Version](https://img.shields.io/visual-studio-code-version/v/zendevve.k1-antigravity-monitor?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=zendevve.k1-antigravity-monitor)
[![License](https://img.shields.io/github/license/Zendevve/k1-antigravity-monitor)](LICENSE)
[![Installs](https://img.shields.io/visual-studio-code-installs/zendevve.k1-antigravity-monitor?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=zendevve.k1-antigravity-monitor)
[![Rating](https://img.shields.io/visual-studio-code-rating/zendevve.k1-antigravity-monitor)](https://marketplace.visualstudio.com/items?itemName=zendevve.k1-antigravity-monitor)

**A hyper-resilient VS Code telemetry extension to monitor the K1 Antigravity Quota inside the editor.**

## Overview

K1 Antigravity Monitor provides real-time monitoring of your Antigravity API quota directly in VS Code's status bar. Stay informed about your token usage, receive smart alerts before quota exhaustion, and optimize your development workflow with intelligent polling and cross-platform support.

![Status Bar Preview](assets/preview.png)

## Features

### 🔄 Real-Time Quota Monitoring
- **Live Status Bar Display**: Track remaining quota for all your models (Claude, GPT, etc.) directly in the status bar
- **Smart Model Selection**: Automatically displays the model closest to exhaustion, or lock to a specific model
- **Visual Indicators**: Color-coded icons (green/yellow/red) for quick quota assessment

### ⚡ Adaptive Polling
- **Intelligent Intervals**: Dynamically scales polling from 30s (idle) to 5s (active) for high-fidelity tracking
- **Platform Optimized**: Custom polling intervals for Windows, macOS, and Linux
- **Resource Efficient**: Minimal background CPU usage with smart scheduling

### 🚨 Smart Alerts
- **Warning & Critical Thresholds**: Customizable alerts at 20% (warning) and 10% (critical)
- **Hysteresis & Cooldown**: Prevents alert flapping with configurable thresholds
- **Quiet Hours**: Schedule alert-free periods (e.g., nights, weekends)
- **Native Notifications**: Integrates with OS notification centers on Windows and macOS

### 🌐 Multi-Source Data
- **Antigravity API**: Direct API polling (primary source)
- **Cloud Billing Integration**: OAuth-based billing data (secondary source)
- **HTTP Interceptor**: Usage tracking via request interception
- **Reconciliation Engine**: Weighted averaging with anomaly detection

### 📊 Historical Data
- **IndexedDB Storage**: Persistent local storage of quota history
- **Trend Analysis**: 24-hour sparkline visualization in tooltips
- **Query API**: Time-range queries for custom analysis

### 🌍 Internationalization
- **6 Languages Supported**: English, Spanish, French, German, Japanese, Chinese (Simplified)
- **Accessibility First**: ARIA labels and keyboard navigation

### 🔒 Privacy Mode
- **Local-Only Operation**: Disable all network calls except to your Antigravity instance
- **Anonymous Identifiers**: Optional anonymized tracking
- **Telemetry Control**: Full control over anonymous usage data

## Requirements

- **VS Code**: Version 1.80.0 or higher
- **Antigravity Instance**: Running local instance bound to port `13337` (default)

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "K1 Antigravity Monitor"
4. Click Install

### From VSIX
```bash
code --install-extension k1-antigravity-monitor-0.1.0.vsix
```

## Quick Start

1. **Start Antigravity**: Ensure your Antigravity instance is running on port `13337`
2. **Auto-Detection**: The extension automatically detects your Antigravity instance
3. **Manual Configuration** (if needed):
   - Go to Settings → Extensions → K1 Antigravity Monitor
   - Configure port if using non-default
4. **Monitor**: Watch your quota in the status bar!

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `pollingIntervalIdle` | 30000 | Polling interval (ms) when idle |
| `pollingIntervalActive` | 5000 | Polling interval (ms) during active use |
| `thresholdWarning` | 20 | Warning threshold percentage |
| `thresholdCritical` | 10 | Critical threshold percentage |
| `showModel` | autoLowest | Display mode: autoLowest or pinned |
| `pinnedModel` | "" | Model to pin when showModel is 'pinned' |
| `animationEnabled` | true | Enable critical pulse animation |
| `sparklineEnabled` | true | Show trend sparkline in tooltip |
| `quietHoursEnabled` | false | Enable quiet hours |
| `localOnlyMode` | false | Disable external network calls |

## Commands

| Command | Description |
|---------|-------------|
| `k1.refreshQuota` | Force immediate quota fetch |
| `k1.switchModel` | Change display focus to different model |
| `k1.togglePanel` | Toggle the quota details panel |
| `k1.showDiagnostics` | Show connection diagnostics |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Host                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Status Bar  │  │  TreeView   │  │  Commands/Handlers  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Core Domain Logic                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ Quota    │  │  Alert   │  │    Polling       │  │  │
│  │  │ State    │  │  Engine  │  │    Scheduler     │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ Source   │  │ Recon-   │  │    Connection   │  │  │
│  │  │ Registry │  │ ciliation│  │    Auto-Reconnect│ │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Data Sources (Pluggable)               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │  │
│  │  │ Source A   │  │ Source B   │  │   Source C   │  │  │
│  │  │ Antigravity│  │ Cloud      │  │   Interceptor│  │  │
│  │  │ API        │  │ Billing    │  │              │  │  │
│  │  └────────────┘  └────────────┘  └──────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Platform Integration                   │  │
│  │  • Platform Detection (Windows/macOS/Linux)       │  │
│  │  • Native Notifications                           │  │
│  │  • Path Handling                                   │  │
│  │  • Storage (IndexedDB, Secrets)                    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Extension not detecting Antigravity

1. Check that Antigravity is running: `http://localhost:13337/health`
2. Set port manually in settings: `k1-antigravity.antigravityPort`
3. Run diagnostics: `k1.showDiagnostics` command

### Status bar not updating

1. Check VS Code notifications for errors
2. Verify polling intervals are not too long
3. Check Antigravity API response times

### Alerts not firing

1. Verify threshold settings
2. Check quiet hours configuration
3. Ensure cooldown period has passed

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting PRs.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

**Zendevve Open Source** | [GitHub](https://github.com/Zendevve/k1-antigravity-monitor) | [Report Issues](https://github.com/Zendevve/k1-antigravity-monitor/issues)
