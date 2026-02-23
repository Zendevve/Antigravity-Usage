import i18next from 'i18next';
import en from './locales/en.json';
import { I18nKey } from './keys';

export async function initI18n(): Promise<void> {
  await i18next.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
  });
}

export function t(key: I18nKey, options?: Record<string, unknown>): string {
  return i18next.t(key, options);
}
