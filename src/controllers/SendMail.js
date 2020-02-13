import {ProgressView, Snackbar} from "../components";

const sendMail = (options, onsuccess, onerror) => {
  const {store, firebase, functionsUrl, ...fields} = options;
  onsuccess = onsuccess || function (res) {
    console.log(res);
    store && store.dispatch({type: Snackbar.SHOW, message: "E-mail has sent"});
    store && store.dispatch(ProgressView.HIDE);
  };
  onerror = onerror || function (error) {
    console.error(error);
    store && store.dispatch({
      type: Snackbar.SHOW,
      message: "E-mail has not sent sent: " + error.message,
      error: true
    });
    store && store.dispatch(ProgressView.HIDE);
  };
  if (!fields.from) {
    onerror(new Error("'from' is not defined"));
    return;
  }
  if (!fields.to) {
    onerror(new Error("'to' is not defined"));
    return
  }
  if (!fields.subject) {
    onerror(new Error("'subject' is not defined"));
    return;
  }
  if (!fields.message) {
    onerror(new Error("'message' is not defined"));
    return
  }
  if (!fields.message) {
    onerror(new Error("'message' is not defined"));
    return
  }
  if (!firebase) {
    onerror(new Error("'firebase' is not defined"));
    return
  }
  fields.time = new Date().getTime();
  store && store.dispatch(ProgressView.SHOW);
  const namedFunction = firebase.functions().httpsCallable("sendMail");
  namedFunction(fields).then(result => {
    onsuccess(result.data, result);
  }).catch(error => {
    onerror(error);
  });
};

export default sendMail;
