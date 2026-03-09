#!/usr/bin/env ts-node
/**
 * Translation Sync Script
 *
 * This script syncs translations between the local repository and Crowdin.
 *
 * Usage:
 *   npm run sync:translations         - Pull translations from Crowdin
 *   npm run sync:translations:push    - Push source strings to Crowdin
 *   npm run sync:translations:status  - Check translation status
 *
 * Environment Variables:
 *   CROWDIN_PROJECT_ID - Your Crowdin project ID
 *   CROWDIN_API_TOKEN - Your Crowdin API token
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Configuration
const SOURCE_FILE = 'src/i18n/locales/en.json';
const LOCALES_DIR = 'src/i18n/locales';
const CROWDIN_CONFIG = 'crowdin.yml';

// Supported languages
const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'ja', 'zh-CN',
  'pt-BR', 'it', 'ko', 'ru', 'ar', 'hi'
];

/**
 * Load JSON file safely
 */
function loadJson(filePath: string): Record<string, unknown> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return {};
  }
}

/**
 * Save JSON file safely
 */
function saveJson(filePath: string, data: Record<string, unknown>): void {
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Get all nested keys from an object
 */
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Check for missing translation keys
 */
function checkMissingKeys(source: Record<string, unknown>, target: Record<string, unknown>): string[] {
  const sourceKeys = getAllKeys(source);
  const targetKeys = getAllKeys(target);

  return sourceKeys.filter(key => !targetKeys.includes(key));
}

/**
 * Check completeness of all locale files
 */
function checkCompleteness(): void {
  console.log('🔍 Checking translation completeness...\n');

  const source = loadJson(SOURCE_FILE);
  const sourceKeys = getAllKeys(source);
  console.log(`Source file: ${SOURCE_FILE}`);
  console.log(`Total keys: ${sourceKeys.length}\n`);

  const results: { language: string; missing: number; percentage: number }[] = [];

  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === 'en') continue;

    const localePath = path.join(LOCALES_DIR, `${lang}.json`);

    if (!fs.existsSync(localePath)) {
      results.push({ language: lang, missing: sourceKeys.length, percentage: 0 });
      console.log(`❌ ${lang}: File not found`);
      continue;
    }

    const target = loadJson(localePath);
    const missing = checkMissingKeys(source, target);
    const percentage = ((sourceKeys.length - missing.length) / sourceKeys.length) * 100;

    results.push({ language: lang, missing: missing.length, percentage });

    if (missing.length > 0) {
      console.log(`⚠️  ${lang}: ${missing.length} missing keys (${percentage.toFixed(1)}%)`);
      if (missing.length <= 10) {
        console.log(`   Missing: ${missing.join(', ')}`);
      }
    } else {
      console.log(`✅ ${lang}: Complete (100%)`);
    }
  }

  console.log('\n--- Summary ---');
  const avgPercentage = results.reduce((sum, r) => sum + r.percentage, 0) / results.length;
  console.log(`Average completeness: ${avgPercentage.toFixed(1)}%`);
}

/**
 * Push source file to Crowdin
 */
function pushToCrowdin(): void {
  console.log('📤 Pushing source strings to Crowdin...\n');

  if (!process.env.CROWDIN_PROJECT_ID || !process.env.CROWDIN_API_TOKEN) {
    console.error('❌ Error: CROWDIN_PROJECT_ID and CROWDIN_API_TOKEN must be set');
    console.log('\nTo set environment variables:');
    console.log('  Windows: set CROWDIN_PROJECT_ID=your_id && set CROWDIN_API_TOKEN=your_token');
    console.log('  Mac/Linux: export CROWDIN_PROJECT_ID=your_id && export CROWDIN_API_TOKEN=your_token');
    process.exit(1);
  }

  try {
    execSync('npx crowdin upload sources', { stdio: 'inherit' });
    console.log('\n✅ Source strings pushed to Crowdin successfully');
  } catch (error) {
    console.error('❌ Error pushing to Crowdin:', error);
    process.exit(1);
  }
}

/**
 * Pull translations from Crowdin
 */
function pullFromCrowdin(): void {
  console.log('📥 Pulling translations from Crowdin...\n');

  if (!process.env.CROWDIN_PROJECT_ID || !process.env.CROWDIN_API_TOKEN) {
    console.error('❌ Error: CROWDIN_PROJECT_ID and CROWDIN_API_TOKEN must be set');
    console.log('\nTo set environment variables:');
    console.log('  Windows: set CROWDIN_PROJECT_ID=your_id && set CROWDIN_API_TOKEN=your_token');
    console.log('  Mac/Linux: export CROWDIN_PROJECT_ID=your_id && export CROWDIN_API_TOKEN=your_token');
    process.exit(1);
  }

  try {
    execSync('npx crowdin download', { stdio: 'inherit' });
    console.log('\n✅ Translations pulled from Crowdin successfully');
  } catch (error) {
    console.error('❌ Error pulling from Crowdin:', error);
    process.exit(1);
  }
}

/**
 * Show Crowdin project status
 */
function showStatus(): void {
  console.log('📊 Translation Status\n');
  console.log('To view detailed status, visit: https://crowdin.com/project/k1-antigravity-monitor');
  console.log('\nRun "npm run sync:translations:push" to upload source strings');
  console.log('Run "npm run sync:translations:pull" to download translations');
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'status';

switch (command) {
  case 'push':
    pushToCrowdin();
    break;
  case 'pull':
    pullFromCrowdin();
    break;
  case 'status':
    showStatus();
    break;
  case 'check':
    checkCompleteness();
    break;
  default:
    console.log('Usage:');
    console.log('  npm run sync:translations         - Check completeness');
    console.log('  npm run sync:translations:push   - Push to Crowdin');
    console.log('  npm run sync:translations:pull    - Pull from Crowdin');
    console.log('  npm run sync:translations:status - Show status');
    process.exit(1);
}
