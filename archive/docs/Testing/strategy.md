# Testing Strategy

## Unit Tests
- Use `mocha` as the test runner.
- Test `quotaService` logic (parsing responses, calculating health).
- Test `statusBarManager` (icon selection logic).

## Integration Tests
- VS Code extension tests using `@vscode/test-electron`.
- Verify commands registration.
- Verify status bar item creation.
