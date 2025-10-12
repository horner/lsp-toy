import i18next from 'i18next';
import * as fs from 'fs';
import * as path from 'path';
import { logDebug } from './utils/logging';

// Initialize i18next with translation files
export async function initializeI18n(locale?: string): Promise<void> {
  const lng = locale || 'en';
  // Extract language code (e.g., 'es' from 'es-ES')
  const language = lng.split('-')[0];
  
  logDebug('Initializing i18n for locale:', lng, '(language:', language + ')');
  
  // Load translation files
  const localesDir = path.join(__dirname, '..', 'locales');
  const supportedLanguages = ['en', 'es', 'fr', 'pl'];
  const resources: Record<string, { translation: Record<string, unknown> }> = {};
  
  for (const lang of supportedLanguages) {
    const translationPath = path.join(localesDir, lang, 'translation.json');
    if (fs.existsSync(translationPath)) {
      try {
        const content = fs.readFileSync(translationPath, 'utf-8');
        resources[lang] = { translation: JSON.parse(content) as Record<string, unknown> };
        logDebug('  ✓ Loaded translations for:', lang);
      } catch (error) {
        logDebug('  ✗ Failed to load translations for', lang + ':', error);
      }
    }
  }
  
  await i18next.init({
    lng: supportedLanguages.includes(language) ? language : 'en',
    fallbackLng: 'en',
    resources,
    interpolation: {
      escapeValue: false // Not needed for server-side
    }
  });
  
  logDebug('  i18n initialized with language:', i18next.language);
}

// Helper function to get locale-aware messages with i18next
export function t(key: string, options?: { count?: number; [key: string]: unknown }): string {
  return i18next.t(key, options);
}
