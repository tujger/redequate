import firebase from "firebase/app";
import "./FirebaseImports";

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

export const fetchFunction = (name, options) => new Promise((resolve, reject) => {
    try {
        firebaseMessaging.auth().onAuthStateChanged(data => {
            data.getIdToken().then(token => {
                const config = {
                    headers: {
                        Authorization: "Bearer " + token
                    }
                };
                const namedFunction = firebaseMessaging.functions().httpsCallable(name, config);
                return namedFunction(options);
            }).then(result => {
                resolve(result.data, result);
            }).catch(reject)
        });
    } catch (error) {
        reject(error);
    }
});

export const fetchCallable = (name, options) => new Promise((resolve, reject) => {
    try {
        const namedFunction = firebaseMessaging.functions().httpsCallable(name);//, config);
        namedFunction(options).then(result => {
            resolve(result.data);
        }).catch(reject)
    } catch (error) {
        reject(error);
    }
});

export const checkIfConnected = () => new Promise((resolve, reject) => {
    return firebaseMessaging.database().ref(".info").once("value").then(snapshot => {
        console.log(snapshot, snapshot.val());
        resolve();
    })
});
