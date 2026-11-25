import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import am from './locales/am.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      am: { translation: am },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    lng: localStorage.getItem('i18nextLng') || 'en',
    react: { useSuspense: false },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18nextLng', lng);
  document.documentElement.setAttribute('lang', lng);
});

// Set lang on init
document.documentElement.setAttribute('lang', i18n.language);

export default i18n;
