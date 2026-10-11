import "firebase/compat/auth";
import "firebase/compat/database";
import "firebase/compat/functions";
import "firebase/compat/storage";
import "firebase/compat/analytics";
import "firebase/compat/messaging";
import firebase from "firebase/compat/app";

export const firebaseMessaging = firebase;
const Firebase = firebaseConfig => {
    try {
        console.log("[Firebase] init")
        firebase.initializeApp(firebaseConfig);
        firebase.config = firebaseConfig;
        if (firebaseConfig.measurementId) {
            firebase.analytics();
        }
    } catch (e) {
        console.error(e);
    }
    // firebase.auth().getRedirectResult().then(res => {
    //     console.log("[Firebase] redirect", res);
    // }).catch(error => {
    //     console.error(error);
    // })
    if (process.env.NODE_ENV === "development") {
        // firebase.functions().useFunctionsEmulator("http://localhost:5001");
    }
    return firebase;
};

export default Firebase;

export const forceFirebaseReinit = () => {
    console.log("[Firebase] reinit", firebase.config)
    return firebase.app().delete().then(() => {
        firebase.initializeApp(firebase.config);
        // if (firebase.config && firebase.config.measurementId) {
        //     firebase.analytics();
        // }
        window.location.reload(); // FIXME
        return firebase;
    });
}
