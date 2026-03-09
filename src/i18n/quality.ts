/**
 * Translation Quality Scoring Module
 *
 * Provides automated quality checks for translations to ensure
 * consistency and accuracy across all supported languages.
 */

import en from './locales/en.json';

export interface TranslationQuality {
  completeness: number;    // 0-100: Percentage of strings translated
  accuracy: number;        // 0-100: Translation accuracy score
  consistency: number;     // 0-100: Consistent terminology usage
  overall: number;         // 0-100: Weighted overall score
}

export interface QualityCheckResult {
  passed: boolean;
  issues: QualityIssue[];
  score: number;
}

export interface QualityIssue {
  type: 'missing' | 'placeholder' | 'formatting' | 'empty';
  key: string;
  message: string;
  severity: 'error' | 'warning';
}

export type QualityLevel = 'gold' | 'silver' | 'bronze' | 'draft';

/**
 * Glossary of key terms that must be translated consistently
 */
export const GLOSSARY: Record<string, string[]> = {
  quota: ['quota', 'limit', 'allocation'],
  threshold: ['threshold', 'limit', 'boundary'],
  warning: ['warning', 'alert', 'notice'],
  critical: ['critical', 'emergency', 'urgent'],
  sparkline: ['sparkline', 'mini-chart', 'trend'],
  forecast: ['forecast', 'prediction', 'projection'],
  dashboard: ['dashboard', 'panel', 'view'],
  alert: ['alert', 'notification', 'alarm'],
};

/**
 * Regular expression to match i18n placeholders
 */
const PLACEHOLDER_REGEX = /\{(\d+)\}|\{(\w+)\}|\{\{(\w+)\}\}/g;

/**
 * Calculate translation quality score for a given locale
 */
export function calculateQuality(translation: Record<string, unknown>): TranslationQuality {
  const completeness = calculateCompleteness(translation);
  const accuracy = calculateAccuracy(translation);
  const consistency = calculateConsistency(translation);

  // Weighted overall score
  const overall = Math.round(
    completeness * 0.4 +
    accuracy * 0.35 +
    consistency * 0.25
  );

  return {
    completeness,
    accuracy,
    consistency,
    overall,
  };
}

/**
 * Calculate completeness score (percentage of keys translated)
 */
function calculateCompleteness(translation: Record<string, unknown>): number {
  const sourceKeys = Object.keys(en);
  const translatedKeys = Object.keys(translation).filter(
    key => translation[key] !== undefined && translation[key] !== ''
  );

  if (sourceKeys.length === 0) return 0;

  return Math.round((translatedKeys.length / sourceKeys.length) * 100);
}

/**
 * Calculate accuracy score based on placeholder matching
 */
function calculateAccuracy(translation: Record<string, unknown>): number {
  const issues = checkPlaceholders(translation);
  const maxIssues = 20; // Cap penalties at 20 issues

  const penalty = Math.min(issues.length, maxIssues) * 5;
  return Math.max(0, 100 - penalty);
}

/**
 * Calculate consistency score based on glossary adherence
 */
function calculateConsistency(translation: Record<string, unknown>): number {
  // Simplified consistency check
  // In a full implementation, this would check against glossary
  const values = Object.values(translation)
    .filter(v => typeof v === 'string')
    .map(v => v as string);

  if (values.length === 0) return 0;

  // Check for empty translations
  const emptyCount = values.filter(v => v.trim() === '').length;
  const emptyPenalty = (emptyCount / values.length) * 50;

  // Check for very short translations (likely incomplete)
  const shortCount = values.filter(v => v.length > 0 && v.length < 3).length;
  const shortPenalty = (shortCount / values.length) * 30;

  return Math.max(0, Math.round(100 - emptyPenalty - shortPenalty));
}

/**
 * Check for placeholder mismatches between source and translation
 */
export function checkPlaceholders(translation: Record<string, unknown>): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const [key, value] of Object.entries(translation)) {
    if (typeof value !== 'string') continue;

    const sourceValue = en[key as keyof typeof en];
    if (typeof sourceValue !== 'string') continue;

    // Extract placeholders from source and translation
    const sourcePlaceholders = extractPlaceholders(sourceValue);
    const transPlaceholders = extractPlaceholders(value);

    // Check for missing placeholders
    for (const sp of sourcePlaceholders) {
      if (!transPlaceholders.includes(sp)) {
        issues.push({
          type: 'placeholder',
          key,
          message: `Missing placeholder: ${sp}`,
          severity: 'error',
        });
      }
    }

    // Check for extra placeholders
    for (const tp of transPlaceholders) {
      if (!sourcePlaceholders.includes(tp)) {
        issues.push({
          type: 'placeholder',
          key,
          message: `Extra placeholder: ${tp}`,
          severity: 'warning',
        });
      }
    }

    // Check for empty translations
    if (value.trim() === '') {
      issues.push({
        type: 'empty',
        key,
        message: 'Empty translation',
        severity: 'error',
      });
    }
  }

  return issues;
}

/**
 * Extract placeholders from a string
 */
function extractPlaceholders(str: string): string[] {
  const matches = str.match(PLACEHOLDER_REGEX);
  return matches || [];
}

/**
 * Get quality level from score
 */
export function getQualityLevel(score: number): QualityLevel {
  if (score >= 95) return 'gold';
  if (score >= 80) return 'silver';
  if (score >= 60) return 'bronze';
  return 'draft';
}

/**
 * Get quality level badge emoji
 */
export function getQualityEmoji(level: QualityLevel): string {
  switch (level) {
    case 'gold': return '🥇';
    case 'silver': return '🥈';
    case 'bronze': return '🥉';
    case 'draft': return '⚠️';
  }
}

/**
 * Run all quality checks on a translation
 */
export function runQualityChecks(translation: Record<string, unknown>): QualityCheckResult {
  const issues = checkPlaceholders(translation);
  const quality = calculateQuality(translation);

  const hasErrors = issues.some(i => i.severity === 'error');

  return {
    passed: !hasErrors && quality.overall >= 60,
    issues,
    score: quality.overall,
  };
}

/**
 * Generate quality report for all supported languages
 */
export interface LanguageQualityReport {
  locale: string;
  quality: TranslationQuality;
  level: QualityLevel;
  issues: number;
}

export function generateQualityReport(
  translations: Map<string, Record<string, unknown>>
): LanguageQualityReport[] {
  const reports: LanguageQualityReport[] = [];

  for (const [locale, translation] of translations) {
    if (locale === 'en') continue; // Skip source language

    const quality = calculateQuality(translation);
    const issues = checkPlaceholders(translation);

    reports.push({
      locale,
      quality,
      level: getQualityLevel(quality.overall),
      issues: issues.length,
    });
  }

  // Sort by quality score descending
  reports.sort((a, b) => b.quality.overall - a.quality.overall);

  return reports;
}
