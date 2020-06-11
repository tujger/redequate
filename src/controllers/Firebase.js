import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/functions";
import "firebase/messaging";
import "firebase/storage";

export const firebaseMessaging = firebase;
const Firebase = firebaseConfig => {
    firebase.initializeApp(firebaseConfig);
    firebase.auth().getRedirectResult().then(console.log)
    if (process.env.NODE_ENV === "development") {
        // firebase.functions().useFunctionsEmulator("http://localhost:5001");
    }
    return firebase;
};

export default Firebase;

export const fetchFunction = firebase => (name, options) => new Promise((resolve, reject) => {
    try {
        firebase.auth().onAuthStateChanged(data => {
            data.getIdToken().then(token => {
                let config = {
                    headers: {
                        "Authorization": "Bearer " + token
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

export const fetchCallable = firebase => (name, options) => new Promise((resolve, reject) => {
    try {
        const namedFunction = firebaseMessaging.functions().httpsCallable(name);//, config);
        namedFunction(options).then(result => {
            resolve(result.data);
        }).catch(reject)
    } catch (error) {
        reject(error);
    }
});
