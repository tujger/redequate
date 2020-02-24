import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/functions";
import "firebase/messaging";
import {logoutUser} from "./User";

let _firebase = null;
const Firebase = firebaseConfig => {
  firebase.initializeApp(firebaseConfig);
  _firebase = firebase;
  return firebase;
};

export default Firebase;

export const fetchFunction = firebase => (name, options, onsuccess, onerror) =>  {
  firebase.auth().onAuthStateChanged(data => {
    if (data) {
      data.getIdToken().then(token => {
        let config = {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        };
        const namedFunction = _firebase.functions().httpsCallable(name, config);
        namedFunction(options).then(result => {
          onsuccess(result.data, result);
        }).catch(error => {
          onerror(error);
        });
      });
    } else {
      logoutUser(firebase)();
    }
  });
};

