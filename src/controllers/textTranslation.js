
export default () => {
    return {
        isAvailable: async () => {
            return true;
        },
        detectLanguage: async text => {
            return "en";
        },
        translateTo: async ({text, source, target}) => {
            return text;
        }
    }
}

let textTranslationInstance;
export const useTextTranslation = initial => {
    if (initial && !textTranslationInstance) textTranslationInstance = initial || {};
    return textTranslationInstance;
}
