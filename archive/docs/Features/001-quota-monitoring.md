# Feature: Real-Time Quota Monitoring & Status Bar

## Purpose
To allow developers using AntiGravity to monitor their AI model quota usage directly within VS Code, avoiding the need to context switch or check external dashboards.

## Business Rules
1. **Monitoring**:
    - The extension must detect the AntiGravity language server process.
    - It must poll for quota data periodically (default: every 5 minutes).
    - It must support multiple models (Gemini, etc.).
2. **Status Bar**:
    - Show an icon indicating health:
        - $(check) > 20% remaining
        - $(warning) < 20% remaining
        - $(error) Exhausted
    - Text: "AGQ" or Pinned Model Stats.
    - Click behavior: Opens Interactive Menu.
3. **Menu**:
    - Lists all detected models.
    - Shows usage percentage and reset time.
    - Allows pinning/unpinning models to the status bar.

## Test Flows
### Scenario 1: Healthy Quota
- **Given**: AntiGravity server is running and returns 80% quota for Gemini.
- **When**: Extension polls data.
- **Then**: Status bar shows $(check).

### Scenario 2: Low Quota
- **Given**: Quota is 10%.
- **When**: Extension polls data.
- **Then**: Status bar shows $(warning).

### Scenario 3: Server Not Found
- **Given**: AntiGravity server (process) is not reachable.
- **Then**: Status bar shows offline indicator or generic "AGQ" with error tooltip.

## Definition of Done
- [ ] Feature implemented in TypeScript.
- [ ] Unit tests for the `QuotaService` (parsing logic).
- [ ] Status bar updates correctly based on mock data.
- [ ] "Pinning" preference is persisted in `globalState`.
