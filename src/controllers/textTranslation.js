import {firebaseMessaging} from "./Firebase";

export default () => {
    const isAvailable = async () => {
        return true;
    }

    const detectLanguage = (text) => new Promise((resolve, reject) => {
        try {
            window.fetch("https://translation.googleapis.com/language/translate/v2/detect?key=" + firebaseMessaging.config.apiKey, {
                method: "POST",
                body: JSON.stringify({
                    q: text,
                })
            })
                .then(response => response.json())
                .then(result => {
                    const {data, error} = result;
                    if (error) throw error;
                    const {detections} = data;
                    const detected = detections[0].map(item => item.language)[0];
                    resolve(detected || "en");
                })
                .catch(reject);
        } catch (error) {
            reject(error)
        }
    })

    const translateTo = ({text, source, target}) => new Promise((resolve, reject) => {
        try {
            window.fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + source + "&tl=" + target + "&dt=t&q=" + encodeURI(text))
                .then(response => response.json())
                .then(result => {
                    const rows = result[0];
                    const source = result[2];
                    const translatedRows = rows.map(row => row[0]);
                    resolve({source, text: translatedRows.join("\n")});
                })
                .catch(error => {
                    console.error(error);
                })
                .then(() => {
                    if (!source || source === "auto") {
                        return detectLanguage(text)
                    } else {
                        return source;
                    }
                })
                .then(source => {
                    translateWithAPITo({text, source, target})
                        .then(resolve)
                        .catch(reject);
                });
        } catch (error) {
            reject(error)
        }
    });

    const translateWithAPITo = ({text, source, target}) => new Promise((resolve, reject) => {
        if (source === target) {
            resolve({source, target});
            return;
        }
        try {
            window.fetch("https://translation.googleapis.com/language/translate/v2?key=" + firebaseMessaging.config.apiKey, {
                method: "POST",
                body: JSON.stringify({
                    q: text,
                    source,
                    target,
                    format: "text",
                })
            })
                .then(response => response.json())
                .then(result => {
                    const {data, error} = result;
                    if (error) throw error;
                    const {translations} = data;
                    const translatedTexts = translations.map(item => item.translatedText);
                    resolve({source, text: translatedTexts.join("\n")});
                })
                .catch(reject);
        } catch (error) {
            reject(error)
        }
    })

    return {
        isAvailable,
        detectLanguage,
        translateTo,
        translateWithAPITo
    }
}

let textTranslationInstance;
export const useTextTranslation = initial => {
    if (initial && !textTranslationInstance) textTranslationInstance = initial || {};
    return textTranslationInstance;
}
