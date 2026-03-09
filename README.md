# K1 Antigravity Monitor

[![Visual Studio Code Version](https://img.shields.io/visual-studio-code-version/v/zendevve.k1-antigravity-monitor?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=zendevve.k1-antigravity-monitor)
[![License](https://img.shields.io/github/license/Zendevve/k1-antigravity-monitor)](LICENSE)
[![Installs](https://img.shields.io/visual-studio-code-installs/zendevve.k1-antigravity-monitor?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=zendevve.k1-antigravity-monitor)
[![Rating](https://img.shields.io/visual-studio-code-rating/zendevve.k1-antigravity-monitor)](https://marketplace.visualstudio.com/items?itemName=zendevve.k1-antigravity-monitor)

**A hyper-resilient VS Code telemetry extension to monitor the K1 Antigravity Quota inside the editor.**

## Overview

K1 Antigravity Monitor provides real-time monitoring of your Antigravity API quota directly in VS Code's status bar. Stay informed about your token usage, receive smart alerts before quota exhaustion, and optimize your development workflow with intelligent polling, forecasting, and cross-platform support.

![Status Bar Preview](assets/preview.png)

## v1.0.0 Release Highlights

- 🚀 **Forecast Engine**: AI-powered quota exhaustion prediction
- 📊 **WebView Dashboard**: Rich ECharts visualizations
- 🌍 **12 Languages**: Full i18n with RTL support
- ♿ **WCAG 2.1 AA**: Complete accessibility compliance

---

## Features

### 🔄 Real-Time Quota Monitoring
- **Live Status Bar Display**: Track remaining quota for all your models directly in the status bar
- **Smart Model Selection**: Automatically displays the model closest to exhaustion, or lock to a specific model
- **Visual Indicators**: Color-coded icons (green/yellow/red) for quick quota assessment
- **Sparkline Trends**: Mini trend visualization in status bar tooltips

### 🔮 Forecast Engine
- **EMA Prediction**: Exponential Moving Average for short-term forecasting
- **Pattern Recognition**: Detects recurring usage patterns
- **Monte Carlo Simulation**: Risk assessment with confidence scores
- **Unified Forecast**: Combines all predictors with weighted confidence

### 📊 WebView Dashboard
- **ECharts Visualizations**: Interactive line, bar, and pie charts
- **Quota Breakdown**: TreeView showing all models and their quotas
- **Export Options**: CSV, JSON, and PDF export
- **Activity Bar Integration**: Native VS Code sidebar view

### ⚡ Adaptive Polling
- **Intelligent Intervals**: Dynamically scales polling from 30s (idle) to 5s (active)
- **Platform Optimized**: Custom polling intervals for Windows, macOS, and Linux
- **Resource Efficient**: Minimal background CPU usage with smart scheduling

### 🚨 Smart Alerts
- **Warning & Critical Thresholds**: Customizable alerts (default: 20% warning, 10% critical)
- **Hysteresis**: Configurable (0-50%) to prevent alert flapping
- **Cooldown**: Configurable time between alerts (default: 5min warning, 2min critical)
- **Quiet Hours**: Schedule alert-free periods with timezone support
- **Snooze**: Temporarily silence alerts
- **Native Notifications**: Integrates with OS notification centers

### 📈 Historical Data
- **IndexedDB Storage**: Persistent local storage of quota history
- **Configurable Retention**: 1-365 days of history
- **Trend Analysis**: 24-hour sparkline visualization
- **Time-Range Queries**: Custom analysis capabilities

### 🌍 Internationalization
- **12 Languages**: English, Spanish, French, German, Japanese, Chinese (Simplified/Traditional), Portuguese (Brazil), Italian, Korean, Russian, Arabic, Hindi
- **RTL Support**: Full right-to-left layout for Arabic
- **Crowdin Integration**: Professional translation workflow
- **Accessibility First**: ARIA labels and keyboard navigation (WCAG 2.1 AA)

### 🔒 Privacy & Control
- **Local-Only Mode**: Disable all network calls except to your Antigravity instance
- **Telemetry Control**: Opt-in anonymous usage tracking
- **Privacy Mode**: Maximum privacy configuration

---

## Requirements

- **VS Code**: Version 1.80.0 or higher
- **Antigravity Instance**: Running local instance bound to port `13337` (default)

---

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "K1 Antigravity Monitor"
4. Click Install

### From VSIX
```bash
code --install-extension k1-antigravity-monitor-1.0.0.vsix
```

---

## Quick Start

1. **Start Antigravity**: Ensure your Antigravity instance is running on port `13337`
2. **Auto-Detection**: The extension automatically detects your Antigravity instance
3. **Manual Configuration** (if needed):
   - Go to Settings → Extensions → K1 Antigravity Monitor
   - Configure port if using non-default
4. **Monitor**: Watch your quota in the status bar!

---

## Commands

| Command | Description |
|---------|-------------|
| `k1.refreshQuota` | Manually refresh quota data |
| `k1.switchModel` | Switch displayed model |
| `k1.togglePanel` | Toggle the dashboard panel |
| `k1.showDiagnostics` | Show diagnostic information |
| `k1.exportCSV` | Export data to CSV |
| `k1.exportJSON` | Export data to JSON |
| `k1.exportPDF` | Export report to PDF |
| `k1.showDashboard` | Show the dashboard |

---

## Configuration

### Polling Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `pollingIntervalIdle` | 30000ms | Polling interval when idle |
| `pollingIntervalActive` | 5000ms | Polling interval when active |

### Alert Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `thresholdWarning` | 20% | Warning threshold percentage |
| `thresholdCritical` | 10% | Critical threshold percentage |
| `alertHysteresisWarning` | 5% | Warning hysteresis to prevent flapping |
| `alertHysteresisCritical` | 5% | Critical hysteresis to prevent flapping |
| `alertCooldownWarning` | 300000ms | Cooldown between warning alerts |
| `alertCooldownCritical` | 120000ms | Cooldown between critical alerts |
| `quietHoursEnabled` | false | Enable quiet hours |
| `quietHoursSchedule` | {days: [0,6], start: "22:00", end: "08:00"} | Quiet hours schedule |

### Display Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `showModel` | autoLowest | Model display mode |
| `animationEnabled` | true | Critical pulse animation |
| `sparklineEnabled` | true | Sparkline trend visualization |
| `sparklineWindowHours` | 24 | Sparkline time window |

### Privacy Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `telemetryEnabled` | false | Enable anonymous telemetry |
| `localOnlyMode` | false | Disable external network calls |

### Language & Accessibility
| Setting | Default | Description |
|---------|---------|-------------|
| `language` | auto | UI language |
| `rtlEnabled` | false | RTL layout |
| `highContrastEnabled` | false | High contrast mode |

---

## Migration Guide

### Upgrading from v0.1.0

v1.0.0 includes major new features. No migration is required - all settings are preserved automatically.

**New in v1.0.0:**
1. **Forecast Engine** - Predictions appear in dashboard
2. **Dashboard** - New Activity Bar view with visualizations
3. **12 Languages** - Full translation coverage
4. **Enhanced Alerts** - Hysteresis, cooldown, quiet hours

---

## Troubleshooting

### Extension Not Loading
- Ensure VS Code version is 1.80.0 or higher
- Check Antigravity is running on the configured port

### Quota Not Updating
- Verify Antigravity instance is accessible
- Check network connectivity
- Try running `k1.refreshQuota` command

### Alerts Not Working
- Check notification permissions in OS settings
- Verify threshold settings
- Check quiet hours configuration

### Dashboard Not Showing
- Click the K1 icon in the Activity Bar
- Run `k1.showDashboard` command
- Check webview is enabled in settings

---

## FAQ

**Q: Does this work with Claude Code?**
A: Yes, it monitors the Antigravity quota which is used by Claude Code.

**Q: How accurate is the forecast?**
A: The forecast uses multiple predictors (EMA, Pattern Matching, Monte Carlo) and provides confidence scores. Accuracy depends on usage patterns.

**Q: Is my data secure?**
A: Yes. All data is stored locally. You can enable local-only mode to disable external network calls.

**Q: Can I use multiple languages?**
A: Yes, the extension supports 12 languages with automatic detection based on VS Code locale.

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Support

- [Report Issues](https://github.com/Zendevve/k1-antigravity-monitor/issues)
- [View Changelog](CHANGELOG.md)
