# K1 Antigravity Monitor

**A hyper-resilient VS Code telemetry extension to monitor the K1 Antigravity Quota inside the editor.**

## Features

- **Real-time Quota Stream:** Tracks your Antigravity models (e.g., `claude-3-opus`, `gpt-4-turbo`) remaining allocations natively in your Status Bar.
- **Adaptive Finite State Machine:** Dynamically scales polling intervals from `30s` (Idle) down to `5s` (Active workload) ensuring high-fidelity tracking with minimal background chatter.
- **Smart Model Locking:** Automatically displays the model closest to quota exhaustion, or lock the status bar to permanently track a single model.
- **Critical Threshold Pulse:** Visual animation pulses red in the status bar globally when quota dips below `10%`. Respects OS `reduceMotion` constraints.
- **Auto-Reconnect Strategy:** In built Exponential Backoff & Jitter natively guards against disconnects and silently recovers telemetry when routing normalizes.
- **Accessible & Internationalized:** Built with i18n support from day 1, and highly typed ARIA accessibility labels for screen-reader ease.

## Requirements

K1 Antigravity Monitor requires a running local instance of the **Antigravity Interface** bound (by default) to port `13337`.

## Extension Settings

You can fully tune the extension's behavior in `settings.json`:

* `k1-antigravity.pollingIntervalIdle`: Milliseconds between API polls when quota is stable. (Default `30000`)
* `k1-antigravity.pollingIntervalActive`: Milliseconds between API polls during heavy IDE workloads. (Default `5000`)
* `k1-antigravity.thresholdWarning`: Percentage limit before firing warning signals. (Default `20`)
* `k1-antigravity.thresholdCritical`: Percentage limit before pulsing alerts and native VS Code notifications. (Default `10`)
* `k1-antigravity.showModel`: Set to `"autoLowest"` or `"pinned"`.
* `k1-antigravity.animationEnabled`: Enable status bar pulses. Set `false` for zero motion.

## Commands

- `k1.refreshQuota`: Force an immediate, out-of-band quota fetch.
- `k1.switchModel`: Change display focus locking the active model.

## Release Notes

### 0.1.0 (Phase 1 MVP)
Initial Beta Version. Complete foundational pipeline.

---
**Zendevve Open Source**
