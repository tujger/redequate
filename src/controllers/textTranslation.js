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

    const translateTo = ({source = "auto", target, text, withApi = true, withoutApi = true}) => new Promise((resolve, reject) => {

        const checkIfSourceEqualsTarget = async props => {
            const {source, target} = props;
            if (source === target) throw props;
            return props;
        }
        const requestTranslationWithoutAPI = async props => {
            if (!withoutApi) return props;
            const {source, target, text} = props;
            try {
                const result = await window.fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + source + "&tl=" + target + "&dt=t&q=" + encodeURI(text))
                    .then(response => response.json())
                return {...props, result};
            } catch (error) {
                console.error(Error("Failed on translate: " + error.toString()));
            }
            return props;
        }
        const extractAndThrowTranslationWithoutAPI = async props => {
            const {result, ...rest} = props;
            if (!result) return rest;
            const rows = result[0];
            const source = result[2];
            const translatedRows = rows.map(row => row[0]);
            throw {source, target, text: translatedRows.join("\n")}
        }
        const detectSourceLanguage = async props => {
            if (!withApi) return props;
            const {source, text} = props;
            if (!source || source === "auto") {
                const newsource = await detectLanguage(text);
                return {...props, source: newsource};
            }
            return props;
        }
        const requestTranslationWithAPI = async props => {
            if (!withApi) return props;
            const {source, target, text} = props;
            const result = await window.fetch("https://translation.googleapis.com/language/translate/v2?key=" + firebaseMessaging.config.apiKey, {
                method: "POST",
                body: JSON.stringify({
                    q: text,
                    source,
                    target,
                    format: "text",
                })
            })
                .then(response => response.json())
            return {...props, result};
        }
        const extractAndThrowTranslationWithAPI = async props => {
            if (!withApi) throw props;
            const {result} = props;
            const {data, error} = result;
            if (error) throw error;
            const {translations} = data;
            const translatedTexts = translations.map(item => item.translatedText);
            throw {source, target, text: translatedTexts.join("\n")};
        }
        const catchEvent = async event => {
            if (event instanceof Error) reject(event);
            resolve(event);
        }

        checkIfSourceEqualsTarget({source, target, text})
            .then(requestTranslationWithoutAPI)
            .then(extractAndThrowTranslationWithoutAPI)
            .then(detectSourceLanguage)
            .then(checkIfSourceEqualsTarget)
            .then(requestTranslationWithAPI)
            .then(extractAndThrowTranslationWithAPI)
            .catch(catchEvent)
    })

    return {
        isAvailable,
        detectLanguage,
        translateTo,
    }
}

let textTranslationInstance;
export const useTextTranslation = initial => {
    if (initial && !textTranslationInstance) textTranslationInstance = initial || {};
    return textTranslationInstance;
}
