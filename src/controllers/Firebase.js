import "firebase/compat/database";
import firebase from "firebase/compat/app";
import {getApp} from "firebase/app";
import {getAnalytics, isSupported} from "firebase/analytics";

// Keep the handle stable for legacy database controllers importing this object.
export const firebaseMessaging = {
    app: undefined,
    config: undefined,
    database: Object.assign((...args) => firebase.app(firebaseMessaging.app.name).database(...args), {
        ServerValue: firebase.database.ServerValue,
    }),
};

const Firebase = firebaseConfig => {
    firebase.initializeApp(firebaseConfig);
    firebaseMessaging.app = getApp();
    firebaseMessaging.config = firebaseConfig;
    if (firebaseConfig.measurementId) {
        isSupported().then(supported => {
            if (supported) getAnalytics(firebaseMessaging.app);
        }).catch(error => console.error("[Firebase] Analytics initialization failed", error));
    }
    return firebaseMessaging;
};

export default Firebase;

export const forceFirebaseReinit = async () => {
    const config = firebaseMessaging.config;
    // Compat deletion also clears its app registry while database uses compat.
    await firebase.app(firebaseMessaging.app.name).delete();
    Firebase(config);
    window.location.reload();
    return firebaseMessaging;
};
