# Changelog

All notable changes to the "k1-antigravity-monitor" extension will be documented in this file.

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
