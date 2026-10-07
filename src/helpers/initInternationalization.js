import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {initReactI18next} from "react-i18next";
import localeEn from "../locales/en-EN.json";
import localeRu from "../locales/ru-RU.json";

export default async function initInternationalization(title, locales) {
    const defaultResources = {
        en: localeEn,
        ru: localeRu,
    };
    let fallbackLng;
    const resources = {};
    const overrideWithResources = locales || defaultResources;
    for (const r in overrideWithResources) {
        fallbackLng = fallbackLng || r;
        resources[r] = {translation: {...(defaultResources[r] || {}), ...overrideWithResources[r]}};
    }
    return i18n.use(LanguageDetector).use(initReactI18next)
        .init({
            debug: false,
            detection: {
                order: ['querystring', 'cookie', 'localStorage', 'sessionStorage', 'navigator', 'htmlTag'],
                lookupLocalStorage: title + "_i18n"
            },
            fallbackLng,
            keySeparator: false,
            parseMissingKeyHandler: (key, defaultValue, options) => {
                if (defaultValue !== undefined) return defaultValue;
                // Missing-key parsing runs after interpolation; translate the
                // English fallback as a default value to interpolate it too.
                return i18n.t(key, {...options, defaultValue: key.replace(/^\w+\./, "")});
            },
            resources,
            saveMissing: false,
        }).then(() => ({i18n, t: i18n.getFixedT()}));
}
