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

export const fetchFunction = firebase => (name, options) => new Promise((resolve, reject) => {
  try {
    firebase.auth().onAuthStateChanged(data => {
      data.getIdToken().then(token => {
        let config = {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        };
        const namedFunction = firebase.functions().httpsCallable(name, config);
        return namedFunction(options);
      }).then(result => {
        resolve(result.data, result);
      }).catch(reject)
    });
  } catch(error) {
    reject(error);
  }
});

export const sendFCM = firebase => options => new Promise((resolve, reject) => {
  const {options:firebaseOptions} = firebase.app();
  let xhr = new XMLHttpRequest();
  xhr.open("POST","https://fcm.googleapis.com/fcm/send", false);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', 'key=AAAADpoXjrk:APA91bGxld3Vv0b9wjDMQ8lHL1EWGcGuK7JXeB2SAT4SFZo_aCFAbWQn3aCmvv4MHLYCYcXQr_3yT5uZZtQc5F_EBfGjFzqlFxPnflNCycjvlrwF8bMjn_29MQdRaewKwXPu5K_Lxxg_');
  var payload = {
    to: options.to,
    // from: firebaseOptions.messagingSenderId,
    notification: {
      title: options.title,
      // body: "",
      // body: bodyNode.value,
      badge: 1,
      // click_action: getTime(startTime.value) ? "odyssey_remind" : "odyssey_regular"
      //click_action: "odyssey_remind"
    },
    // priority: "high"
    // content_available: true
  };
  xhr.onreadystatechange = event => {
    if(xhr.readyState === xhr.DONE) {
      if(xhr.status === 200) {
        const {multicast_id, success, failure, results, canonical_ids} = JSON.parse(xhr.response);
        if(success) {
          resolve(multicast_id);
        } else {
          const error = results[0].error;
          reject(new Error("Failed for " + options.to + ": " + error));
        }
      } else {
        reject(new Error("Failed for " + options.to + ": " + xhr.status + ": " + xhr.response));
      }
    }
  };
  xhr.send(JSON.stringify(payload));


});
