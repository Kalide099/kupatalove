const fetch = require('node-fetch');

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

// LibreTranslate language code mapping
const LANG_MAP = {
  en: 'en', fr: 'fr', es: 'es', ar: 'ar', zh: 'zh',
  pt: 'pt', de: 'de', it: 'it', ru: 'ru', ja: 'ja',
  ko: 'ko', tr: 'tr', nl: 'nl', pl: 'pl', sv: 'sv',
  sw: 'sw', hi: 'hi', bn: 'bn', vi: 'vi', th: 'th',
};

/**
 * Translate text from one language to another
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {Promise<string>} Translated text
 */
const translateText = async (text, sourceLang = 'en', targetLang = 'en') => {
  if (sourceLang === targetLang) return text;
  if (!text || text.trim() === '') return text;

  const source = LANG_MAP[sourceLang] || 'en';
  const target = LANG_MAP[targetLang] || 'en';
  if (source === target) return text;

  try {
    const body = {
      q: text,
      source,
      target,
      format: 'text',
    };
    if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;

    const response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 8000,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`LibreTranslate error (${response.status}): ${errText}`);
      return text; // fallback to original
    }

    const data = await response.json();
    return data.translatedText || text;
  } catch (err) {
    console.warn('Translation service unavailable, using original text:', err.message);
    return text;
  }
};

/**
 * Detect language of text
 */
const detectLanguage = async (text) => {
  try {
    const body = { q: text };
    if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;

    const response = await fetch(`${LIBRETRANSLATE_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 5000,
    });
    if (!response.ok) return 'en';
    const data = await response.json();
    return data[0]?.language || 'en';
  } catch {
    return 'en';
  }
};

module.exports = { translateText, detectLanguage };
