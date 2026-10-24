import {initializeApp, deleteApp} from "firebase/app";
import {getAnalytics, isSupported} from "firebase/analytics";

const firebase = {
    app: undefined,
    config: undefined,
};

const Firebase = firebaseConfig => {
    firebase.app = initializeApp(firebaseConfig);
    firebase.config = firebaseConfig;
    if (firebaseConfig.measurementId) {
        isSupported().then(supported => {
            if (supported) getAnalytics(firebase.app);
        }).catch(error => console.error("[Firebase] Analytics initialization failed", error));
    }
    return firebase;
};

export default Firebase;

export const forceFirebaseReinit = async () => {
    const config = firebase.config;
    await deleteApp(firebase.app);
    Firebase(config);
    window.location.reload();
    return firebase;
};
