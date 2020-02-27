import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/functions";
import "firebase/messaging";

let _firebase = null;
const Firebase = firebaseConfig => {
  firebase.initializeApp(firebaseConfig);
  if (process.env.NODE_ENV === 'development') {
    // firebase.functions().useFunctionsEmulator('http://localhost:5001');
  }
  _firebase = firebase;
  return firebase;
};

export default Firebase;

export const fetchFunction = firebase => (name, options) => new Promise((resolve, reject) => {
  try {
    firebase.auth().onAuthStateChanged(data => {
      data.getIdToken().then(token => {
        let config = {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        };
        const namedFunction = _firebase.functions().httpsCallable(name, config);
        return namedFunction(options);
      }).then(result => {
        resolve(result.data, result);
      }).catch(reject)
    });
  } catch(error) {
    reject(error);
  }
});

export const fetchCallable = firebase => (name, options) => new Promise((resolve, reject) => {
  try {
    const namedFunction = firebase.functions().httpsCallable(name);//, config);
    namedFunction(options).then(result => {
      resolve(result.data);
    }).catch(reject)
  } catch(error) {
    reject(error);
  }
});
