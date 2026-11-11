import {initializeApp, deleteApp} from "firebase/app";
import {getAnalytics, isSupported} from "firebase/analytics";

const firebase = {
    app: undefined,
    config: undefined,
};

let firebaseOptions = {};

const Firebase = (firebaseConfig, {analytics = true} = {}) => {
    firebaseOptions = {analytics};
    firebase.app = initializeApp(firebaseConfig);
    firebase.config = firebaseConfig;
    if (analytics && firebaseConfig.measurementId) {
        isSupported().then(supported => {
            if (supported) getAnalytics(firebase.app);
        }).catch(error => console.error("[Firebase] Analytics initialization failed", error));
    }
    return firebase;
};

export default Firebase;

export const forceFirebaseReinit = async () => {
    const config = firebase.config;
    const options = firebaseOptions;
    await deleteApp(firebase.app);
    Firebase(config, options);
    window.location.reload();
    return firebase;
};
