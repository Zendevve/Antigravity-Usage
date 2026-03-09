import i18next from 'i18next';
import * as vscode from 'vscode';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-CN.json';
import { I18nKey } from './keys';

/**
 * Supported languages with their codes
 */
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  'zh-CN': '简体中文',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

/**
 * Map VSCode locale to supported i18n locale
 */
function mapVscodeLocaleToI18n(vscodeLocale: string): SupportedLanguage {
  // Handle language tags like 'en-US', 'zh-CN', etc.
  const normalizedLocale = vscodeLocale.toLowerCase().replace('_', '-');

  // Direct match
  if (normalizedLocale in SUPPORTED_LANGUAGES) {
    return normalizedLocale as SupportedLanguage;
  }

  // Handle region variants
  const languageCode = normalizedLocale.split('-')[0];

  // Map Chinese variants
  if (languageCode === 'zh') {
    return 'zh-CN';
  }

  // Check if we have this language
  const matchedLanguage = Object.keys(SUPPORTED_LANGUAGES).find(
    (lang) => lang.startsWith(languageCode)
  );

  if (matchedLanguage) {
    return matchedLanguage as SupportedLanguage;
  }

  // Default to English
  return 'en';
}

/**
 * Get VSCode locale
 */
function getVscodeLocale(): string {
  try {
    return vscode.env.language;
  } catch {
    return 'en';
  }
}

/**
 * Initialize i18n with language detection from VSCode
 */
export async function initI18n(): Promise<void> {
  const vscodeLocale = getVscodeLocale();
  const i18nLocale = mapVscodeLocaleToI18n(vscodeLocale);

  await i18next.init({
    lng: i18nLocale,
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ja: { translation: ja },
      'zh-CN': { translation: zhCN },
    },
    interpolation: { escapeValue: false },
  });
}

/**
 * Translation function
 */
export function t(key: I18nKey, options?: Record<string, unknown>): string {
  return i18next.t(key, options);
}

/**
 * Get current language
 */
export function getCurrentLanguage(): SupportedLanguage {
  return i18next.language as SupportedLanguage;
}

/**
 * Change language
 */
export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18next.changeLanguage(language);
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): Record<string, string> {
  return SUPPORTED_LANGUAGES;
}
