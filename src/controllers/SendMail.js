import {ProgressView, Snackbar} from "../components";
import {notifySnackbar} from "../controllers/Notifications";

const sendMail = (options) => new Promise((resolve, reject) => {
  const {store, firebase, functionsUrl, ...fields} = options;
  if (!fields.from) {
    reject(new Error("'from' is not defined"));
    return;
  }
  if (!fields.to) {
    reject(new Error("'to' is not defined"));
    return
  }
  if (!fields.subject) {
    reject(new Error("'subject' is not defined"));
    return;
  }
  if (!fields.message) {
    reject(new Error("'message' is not defined"));
    return
  }
  if (!fields.message) {
    reject(new Error("'message' is not defined"));
    return
  }
  if (!firebase) {
    reject(new Error("'firebase' is not defined"));
    return
  }
  fields.time = new Date().getTime();
  store && store.dispatch(ProgressView.SHOW);
  const namedFunction = firebase.functions().httpsCallable("sendMail");
  namedFunction(fields).then(result => {
    resolve(result.data, result);
  }).catch(reject);
});

export default sendMail;
