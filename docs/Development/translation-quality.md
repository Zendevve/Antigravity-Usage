# K1 Antigravity Monitor Translation Quality Scoring

This document defines the translation quality metrics and workflow for the K1 Antigravity Monitor project.

## Translation Quality Interface

```typescript
export interface TranslationQuality {
  completeness: number;    // 0-100: Percentage of strings translated
  accuracy: number;        // 0-100: Translation accuracy score
  consistency: number;      // 0-100: Consistent terminology usage
  overall: number;          // 0-100: Weighted overall score
}
```

## Quality Thresholds

| Level | Overall Score | Status |
|-------|---------------|--------|
| 🥇 Gold | 95-100 | Ready for release |
| 🥈 Silver | 80-94 | Needs review |
| 🥉 Bronze | 60-79 | In progress |
| ⚠️ Draft | 0-59 | Not ready |

## Automated Quality Checks

### 1. Completeness Check
- All keys from `en.json` must be translated
- Placeholders must be preserved (e.g., `{0}`, `{count}`)
- Plural forms must be handled correctly

### 2. Accuracy Check
- No machine translation detected (configurable)
- Variable placeholders match source
- No missing or extra formatting tokens

### 3. Consistency Check
- Same terms translate to same words
- Consistent casing and punctuation
- Glossary terms followed

## Review Workflow

1. **Translation**: Community contributor submits translation
2. **Auto-Review**: Automated checks run (completeness, placeholders)
3. **Peer Review**: Native speaker reviews for accuracy
4. **Approval**: Project maintainer approves for release

## Glossary

Key terms that must be translated consistently:

| English | Description |
|---------|-------------|
| quota | API quota / rate limit |
| threshold | Alert threshold percentage |
| warning | Warning level alert |
| critical | Critical level alert |
| sparkline | Mini trend chart |
| forecast | Predicted usage |
| dashboard | Main monitoring view |

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for translation contribution guidelines.
