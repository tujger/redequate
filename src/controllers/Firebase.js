import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/functions";
import {logoutUser} from "./User";

const Firebase = firebaseConfig => {
  firebase.initializeApp(firebaseConfig);
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
        const namedFunction = firebase.functions().httpsCallable(name, config);
        namedFunction(options).then(result => {
          onsuccess(result.data, result);
        }).catch(error => {
          onerror(error);
        });
      });
    } else {
      logoutUser();
    }
  });
};

