import {getI18n} from "react-i18next";

export const languageReducer = (state = {locale: null}, action) => {
    switch (action.type) {
        case languageReducer.CHANGE:
            return {...state, locale: action.locale};
        default:
            return state;
    }
};
languageReducer.CHANGE = "language_Change";

export const restoreLanguage = (i18n = getI18n()) => {
    try {
        i18n.changeLanguage()
            .then(() => {
                if (!i18n.options.resources) return;
                if (i18n.options.resources[i18n.language]) return;
                for (const lang of i18n.languages) {
                    if (i18n.options.resources[lang]) {
                        i18n.changeLanguage(lang);
                        return;
                    }
                }
            }).catch(e => console.error(e));
    } catch (e) {
        console.error(e);
    }
}
