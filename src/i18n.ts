import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './i18n/en.json';
import es from './i18n/es.json';

const savedLanguage = localStorage.getItem('i18nLanguage') || 'en';
i18n.use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: savedLanguage, // use persisted language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })
  .catch(() => {});

// Listen for language changes and persist them
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18nLanguage', lng);
});

export default i18n;
