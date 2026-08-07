/**
 * KupataLove i18n — Client-side internationalization
 * Loads locale JSON and replaces data-i18n attributes
 */

const SUPPORTED_LANGS = [
  { code: 'en', name: 'English',    flag: '🇬🇧', nativeName: 'English' },
  { code: 'fr', name: 'French',     flag: '🇫🇷', nativeName: 'Français' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸', nativeName: 'Español' },
  { code: 'ar', name: 'Arabic',     flag: '🇸🇦', nativeName: 'العربية', rtl: true },
  { code: 'zh', name: 'Chinese',    flag: '🇨🇳', nativeName: '中文' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', nativeName: 'Português' },
  { code: 'de', name: 'German',     flag: '🇩🇪', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian',    flag: '🇮🇹', nativeName: 'Italiano' },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'ja', name: 'Japanese',   flag: '🇯🇵', nativeName: '日本語' },
  { code: 'ko', name: 'Korean',     flag: '🇰🇷', nativeName: '한국어' },
  { code: 'tr', name: 'Turkish',    flag: '🇹🇷', nativeName: 'Türkçe' },
  { code: 'nl', name: 'Dutch',      flag: '🇳🇱', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish',     flag: '🇵🇱', nativeName: 'Polski' },
  { code: 'sv', name: 'Swedish',    flag: '🇸🇪', nativeName: 'Svenska' },
  { code: 'sw', name: 'Swahili',    flag: '🇰🇪', nativeName: 'Kiswahili' },
  { code: 'hi', name: 'Hindi',      flag: '🇮🇳', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali',    flag: '🇧🇩', nativeName: 'বাংলা' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
  { code: 'th', name: 'Thai',       flag: '🇹🇭', nativeName: 'ภาษาไทย' },
];

let currentLocale = {};
let currentLang = 'en';

/**
 * Load locale from JSON file or API
 */
const loadLocale = async (lang) => {
  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) throw new Error('locale not found');
    return await res.json();
  } catch {
    // Fall back to English
    try {
      const fallback = await fetch('/locales/en.json');
      return await fallback.json();
    } catch {
      return {};
    }
  }
};

/**
 * Apply translations to the DOM
 */
const applyTranslations = (locale) => {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (locale[key]) el.textContent = locale[key];
  });
  // Placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (locale[key]) el.placeholder = locale[key];
  });
  // Title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (locale[key]) el.title = locale[key];
  });
};

/**
 * Initialize i18n system
 */
const initI18n = async (lang) => {
  // Detect language: from param > localStorage > browser > 'en'
  if (!lang) {
    const stored = localStorage.getItem('kl_language');
    const browserLang = navigator.language?.slice(0, 2);
    lang = stored || (SUPPORTED_LANGS.find(l => l.code === browserLang) ? browserLang : 'en');
  }

  currentLang = lang;
  localStorage.setItem('kl_language', lang);

  currentLocale = await loadLocale(lang);
  applyTranslations(currentLocale);

  // Set RTL for Arabic
  const langConfig = SUPPORTED_LANGS.find(l => l.code === lang);
  document.documentElement.dir = langConfig?.rtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;

  return currentLocale;
};

/**
 * Translate a key
 */
const t = (key, replacements = {}) => {
  let str = currentLocale[key] || key;
  Object.entries(replacements).forEach(([k, v]) => {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return str;
};

/**
 * Switch language at runtime
 */
const switchLanguage = async (lang) => {
  await initI18n(lang);
};

// Export
window.KL_I18n = { initI18n, switchLanguage, t, SUPPORTED_LANGS, getCurrentLang: () => currentLang };
