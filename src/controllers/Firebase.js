import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/functions";

const Firebase = firebaseConfig => {
  firebase.initializeApp(firebaseConfig);
  return firebase;
};

export default Firebase;
