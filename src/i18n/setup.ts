import i18next from 'i18next';
import * as vscode from 'vscode';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-CN.json';
import ptBR from './locales/pt-BR.json';
import it from './locales/it.json';
import ko from './locales/ko.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
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
  'pt-BR': 'Português (Brasil)',
  it: 'Italiano',
  ko: '한국어',
  ru: 'Русский',
  ar: 'العربية',
  hi: 'हिन्दी',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

/**
 * RTL (Right-to-Left) languages that require layout mirroring
 */
export const RTL_LANGUAGES: string[] = ['ar', 'he'];

/**
 * Check if a language is RTL
 */
export function isRTL(language: string): boolean {
  return RTL_LANGUAGES.includes(language);
}

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

  // Map Portuguese variants
  if (languageCode === 'pt') {
    return 'pt-BR';
  }

  // Map Hebrew
  if (languageCode === 'he') {
    return 'ar'; // Use Arabic as fallback for Hebrew (similar RTL)
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
 * Get user's preferred language from VSCode settings
 */
function getUserPreferredLanguage(): SupportedLanguage | 'auto' {
  try {
    const config = vscode.workspace.getConfiguration('k1-antigravity');
    const languageSetting = config.get<string>('language', 'auto');
    if (languageSetting && languageSetting !== 'auto' && languageSetting in SUPPORTED_LANGUAGES) {
      return languageSetting as SupportedLanguage;
    }
  } catch {
    // Ignore errors, use auto-detection
  }
  return 'auto';
}

/**
 * Initialize i18n with language detection from VSCode
 */
export async function initI18n(): Promise<void> {
  const userPreference = getUserPreferredLanguage();

  let i18nLocale: SupportedLanguage;
  if (userPreference !== 'auto') {
    i18nLocale = userPreference;
  } else {
    const vscodeLocale = getVscodeLocale();
    i18nLocale = mapVscodeLocaleToI18n(vscodeLocale);
  }

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
      'pt-BR': { translation: ptBR },
      it: { translation: it },
      ko: { translation: ko },
      ru: { translation: ru },
      ar: { translation: ar },
      hi: { translation: hi },
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
 * Get current language direction
 */
export function getTextDirection(): 'ltr' | 'rtl' {
  const currentLang = getCurrentLanguage();
  return isRTL(currentLang) ? 'rtl' : 'ltr';
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

/**
 * Get locale-specific date format
 */
export function getDateFormat(locale: SupportedLanguage): Intl.DateTimeFormatOptions {
  const formats: Record<SupportedLanguage, Intl.DateTimeFormatOptions> = {
    en: { year: 'numeric', month: 'short', day: 'numeric' },
    es: { year: 'numeric', month: 'short', day: 'numeric' },
    fr: { year: 'numeric', month: 'short', day: 'numeric' },
    de: { year: 'numeric', month: 'short', day: 'numeric' },
    ja: { year: 'numeric', month: 'short', day: 'numeric' },
    'zh-CN': { year: 'numeric', month: 'short', day: 'numeric' },
    'pt-BR': { year: 'numeric', month: 'short', day: 'numeric' },
    it: { year: 'numeric', month: 'short', day: 'numeric' },
    ko: { year: 'numeric', month: 'short', day: 'numeric' },
    ru: { year: 'numeric', month: 'short', day: 'numeric' },
    ar: { year: 'numeric', month: 'short', day: 'numeric' },
    hi: { year: 'numeric', month: 'short', day: 'numeric' },
  };
  return formats[locale] || formats.en;
}

/**
 * Get locale-specific number format
 */
export function getNumberFormat(locale: SupportedLanguage): Intl.NumberFormatOptions {
  const formats: Record<SupportedLanguage, Intl.NumberFormatOptions> = {
    en: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    es: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    fr: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    de: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    ja: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    'zh-CN': { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    'pt-BR': { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    it: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    ko: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    ru: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    ar: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
    hi: { minimumFractionDigits: 0, maximumFractionDigits: 2 },
  };
  return formats[locale] || formats.en;
}

/**
 * Format a number according to locale
 */
export function formatNumber(value: number, locale?: SupportedLanguage): string {
  const currentLocale = locale || getCurrentLanguage();
  const localeCode = currentLocale === 'zh-CN' ? 'zh-Hans' :
    currentLocale === 'pt-BR' ? 'pt-BR' :
      currentLocale;
  return new Intl.NumberFormat(localeCode, getNumberFormat(currentLocale)).format(value);
}

/**
 * Format a date according to locale
 */
export function formatDate(date: Date, locale?: SupportedLanguage): string {
  const currentLocale = locale || getCurrentLanguage();
  const localeCode = currentLocale === 'zh-CN' ? 'zh-Hans' :
    currentLocale === 'pt-BR' ? 'pt-BR' :
      currentLocale;
  return new Intl.DateTimeFormat(localeCode, getDateFormat(currentLocale)).format(date);
}
