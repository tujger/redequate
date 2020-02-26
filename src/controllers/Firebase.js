import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/functions";
import "firebase/messaging";

let _firebase = null;
const Firebase = firebaseConfig => {
  firebase.initializeApp(firebaseConfig);
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
        console.log(_firebase.functions());
        const namedFunction = _firebase.functions().httpsCallable(name, config);
        return namedFunction(options);
      }).then(result => {
  console.log("RESULT", result);
        resolve(result.data, result);
      }).catch(reject)
    });
  } catch(error) {
    reject(error);
  }
});
