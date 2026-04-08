import cs from '@/locales/cs.json';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGE_STORAGE_KEY = 'kefer-language';

export const SUPPORTED_LANGUAGES = ['cs', 'en', 'fr', 'es'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function readStoredLanguage(): AppLanguage {
	try {
		const v = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		if (v && (SUPPORTED_LANGUAGES as readonly string[]).includes(v)) {
			return v as AppLanguage;
		}
	} catch {
		/* ignore */
	}
	return 'cs';
}

void i18n.use(initReactI18next).init({
	resources: {
		cs: { translation: cs },
		en: { translation: en },
		fr: { translation: fr },
		es: { translation: es }
	},
	lng: readStoredLanguage(),
	fallbackLng: 'en',
	interpolation: { escapeValue: false }
});

i18n.on('languageChanged', (lng) => {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
	} catch {
		/* ignore */
	}
});

export default i18n;
