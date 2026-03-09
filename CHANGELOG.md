# Changelog

All notable changes to the "k1-antigravity-monitor" extension will be documented in this file.

## [v1.0.0] - 2026-03-09

### 🚀 Major Features

#### Forecast Engine (Sprint 9)
- **EMA-Based Short-Term Prediction**: Exponential Moving Average predictor for usage forecasting
- **Pattern Matcher**: Recognizes recurring usage patterns for improved predictions
- **Monte Carlo Simulation**: Risk assessment with confidence scores using stochastic modeling
- **Unified Forecast Engine**: Combines all predictors with weighted confidence scoring
- **Time Series Analysis**: Complete time-series data infrastructure with storage and querying

#### WebView Dashboard (Sprint 10)
- **ECharts Visualizations**: Rich interactive charts for quota visualization
- **Typed Message Protocol**: Type-safe communication between extension and webview
- **Export Functionality**: CSV, JSON, and PDF export capabilities
- **Dashboard ViewContainer**: Integrated Activity Bar view with webview

#### Internationalization & Accessibility (Sprint 11)
- **12 Languages Supported**: English, Spanish, French, German, Japanese, Chinese (Simplified/Traditional), Portuguese (Brazilian), Italian, Korean, Russian, Arabic, Hindi
- **RTL Layout Support**: Full right-to-left layout support for Arabic
- **Crowdin Integration**: Professional translation workflow
- **WCAG 2.1 AA Compliance**: Full accessibility support with ARIA labels

### Added

#### Core Monitoring
- Multi-source quota monitoring (Source A, B, C)
- Reconciliation engine with weighted averaging
- Real-time status bar with sparklines
- TreeView quota breakdown in Activity Bar
- IndexedDB history storage with configurable retention

#### Alert System
- Configurable warning/critical thresholds
- Alert hysteresis to prevent flapping (configurable 0-50%)
- Cooldown between alerts (default: 5min warning, 2min critical)
- Quiet hours scheduling with timezone support
- Snooze functionality

#### Forecasting Features
- EMA-based short-term prediction (alpha=0.3 default)
- Pattern matcher for usage recognition
- Monte Carlo simulation (1000 iterations default)
- Unified forecast with confidence scores (0-100%)

#### Dashboard
- WebView-based dashboard in Activity Bar
- ECharts line/bar/pie visualizations
- Typed message protocol (v1.0)
- CSV/JSON/PDF export

#### Platform
- Cross-platform (Windows, macOS, Linux)
- Platform-specific polling optimizations
- Native OS notifications

#### Privacy & Settings
- Privacy mode (local-only network calls)
- Telemetry control (opt-in)
- 15+ configuration options

### Changed
- Improved polling efficiency with idle/active detection
- Enhanced alert system with hysteresis and cooldown
- Refined sparkline visualization in status bar tooltips

### Fixed
- Network resilience with exponential backoff
- Race condition fixes in quota polling
- Memory leak fixes in long-running sessions

### Commands Added
- `k1.refreshQuota` - Manually refresh quota data
- `k1.switchModel` - Switch displayed model
- `k1.togglePanel` - Toggle the dashboard panel
- `k1.showDiagnostics` - Show diagnostic information
- `k1.exportCSV` - Export data to CSV
- `k1.exportJSON` - Export data to JSON
- `k1.exportPDF` - Export report to PDF
- `k1.showDashboard` - Show the dashboard

### Configuration Options
- `k1-antigravity.pollingIntervalIdle` - Polling interval when idle (default: 30s)
- `k1-antigravity.pollingIntervalActive` - Polling interval when active (default: 5s)
- `k1-antigravity.thresholdWarning` - Warning threshold % (default: 20%)
- `k1-antigravity.thresholdCritical` - Critical threshold % (default: 10%)
- `k1-antigravity.showModel` - Model display mode (autoLowest/pinned)
- `k1-antigravity.pinnedModel` - Pinned model ID
- `k1-antigravity.animationEnabled` - Critical pulse animation (default: true)
- `k1-antigravity.antigravityPort` - Antigravity port (default: 13337)
- `k1-antigravity.sparklineEnabled` - Sparkline in tooltip (default: true)
- `k1-antigravity.sparklineWindowHours` - Sparkline window (default: 24h)
- `k1-antigravity.historyRetentionDays` - History retention (default: 30 days)
- `k1-antigravity.historySnapshotIntervalMinutes` - Snapshot interval (default: 5 min)
- `k1-antigravity.alertHysteresisWarning` - Warning hysteresis (default: 5%)
- `k1-antigravity.alertHysteresisCritical` - Critical hysteresis (default: 5%)
- `k1-antigravity.alertCooldownWarning` - Warning cooldown (default: 5 min)
- `k1-antigravity.alertCooldownCritical` - Critical cooldown (default: 2 min)
- `k1-antigravity.quietHoursEnabled` - Quiet hours (default: false)
- `k1-antigravity.quietHoursSchedule` - Quiet hours schedule
- `k1-antigravity.quietHoursTimezone` - Quiet hours timezone
- `k1-antigravity.telemetryEnabled` - Telemetry (default: false)
- `k1-antigravity.localOnlyMode` - Local-only mode (default: false)
- `k1-antigravity.language` - Language (default: auto)
- `k1-antigravity.rtlEnabled` - RTL layout (default: false)
- `k1-antigravity.highContrastEnabled` - High contrast (default: false)

---

## [v0.1.0] - 2026-02-23

### Added
- Phase 1 MVP Release!
- Dynamic Status Bar integration detecting real-time Antigravity API quotas.
- Alert Engine powering custom Warning (20%) and Critical (10%) threshold toasts.
- Adaptive Polling scheduler handling rapid quota drains and idle preservation.
- Smart `autoLowest` model routing.
- Experimental critical Red pulse animation for extreme low quota awareness.
- Exponential backoff recovery handling dropping and jittered network environments.
- Commands: `k1.refreshQuota`, `k1.switchModel`, `k1.showDiagnostics`.
- First-class i18N pipeline and strict ARIA label definitions.
