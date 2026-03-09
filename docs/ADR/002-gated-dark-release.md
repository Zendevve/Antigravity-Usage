# ADR 002: Gated Dark Release Strategy for Phases 2-4

## Status
Accepted

## Context
The project roadmap (implementation_plan.md) outlines Phases 2-4 spanning 16 weeks with increasing feature complexity:
- Phase 2 (Sprints 5-8): Standard Release - Multi-source data, UI enhancements, i18n
- Phase 3 (Sprints 9-12): Advanced Release - Forecasting engine, WebView dashboard, 12 languages
- Phase 4 (Sprints 13-16+): Ecosystem - Public API, team features, community

The challenge is releasing progressively more complex features while maintaining stability, gathering feedback, and managing user expectations across a VSCode marketplace extension.

## Decision
We will implement a **Gated Dark Release** strategy with 4 tiers:

### Tier 1: Internal Alpha (Sprints 5-6)
- **Features**: Source B/C, reconciliation engine, TreeView panel
- **Release**: Development builds only
- **Audience**: Core team developers
- **Criteria**: Unit tests pass, basic manual testing
- **Rollback**: Revert to previous sprint branch

### Tier 2: Closed Beta (Sprint 7)
- **Features**: Alert improvements, 6 languages, privacy mode
- **Release**: Internal Testing channel (.vsix)
- **Audience**: 5-10 trusted beta users
- **Criteria**: E2E tests pass, crash-free rate >99%
- **Rollback**: Update channel to previous stable

### Tier 3: Public Beta / Feature Flag (Sprint 8)
- **Features**: E2E expansion, cross-platform fixes, marketplace publication
- **Release**: VSCode Marketplace (beta tag)
- **Audience**: All extension users
- **Criteria**: <1% crash rate, <5% error rate, user feedback loop
- **Rollback**: Feature flags disable new features, revert marketplace listing

### Tier 4: Stable Release (Sprints 9-16+)
- **Features**: Forecasting, WebView dashboard, 12 languages, public API
- **Release**: Stable channel on marketplace
- **Audience**: All users (default)
- **Criteria**: Production metrics meet thresholds
- **Rollback**: Re-publish previous stable version

## Implementation Requirements

### Feature Flags System
- Global feature flag registry in `src/util/feature-flags.ts`
- Per-user feature enablement stored in VSCode config
- Fallback to safe defaults if config unavailable
- Flag structure: `{ id: string, enabled: boolean, rolloutPercentage: number }`

### Telemetry Integration
- Anonymous usage metrics (opt-in)
- Feature adoption tracking
- Error rate monitoring
- Performance benchmarks

### Release Channels
- `dev`: npm run package (manual development builds)
- `beta`: GitHub releases with beta tag
- `stable`: VSCode Marketplace automatic updates

### Rollback Procedures
- Documented rollback scripts for each tier
- Database/migrations rollback for IndexedDB schema changes
- Feature flag "kill switches" for emergency disable

## Consequences

### Positive
- **Risk Mitigation**: Large features released incrementally with fallbacks
- **User Trust**: Beta users feel involved in development
- **Market Fit**: Real-world feedback before full release
- **Stability**: Progressive exposure catches edge cases
- **5 Pillars Alignment**: "Radical Efficiency" - deploy incrementally vs. big bang

### Negative
- **Complexity**: Feature flag management overhead
- **Testing Burden**: More test environments needed
- **Coordination**: Release management across channels
- **Delayed Full Release**: Time-to-market increases

## Compliance
- **Hick's Law**: Minimize user choice by gating complex features until stable
- **Doherty Threshold**: Ensure performance doesn't degrade with feature flags
- **Aesthetic-Usability**: Stable UI in stable channel, experimental in dark

## Notes
- This ADR should be saved as `docs/ADR/002-gated-dark-release.md`
- Follow the ADR format from `archive/docs/ADR/001-unified-renderer.md`
- Update this ADR if release strategy changes significantly
- This supersedes any conflicting instructions
