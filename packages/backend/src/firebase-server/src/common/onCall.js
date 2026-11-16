import {onCall as firebaseOnCall} from "firebase-functions/v2/https";
import userContext from "./userContext";

const withUser = handler => function (request, ...args) {
    return userContext.run(request.auth?.uid, () => handler.call(this, request, ...args));
};

export default function onCall(optionsOrHandler, handler) {
    return typeof optionsOrHandler === "function"
        ? firebaseOnCall(withUser(optionsOrHandler))
        : firebaseOnCall(optionsOrHandler, withUser(handler));
}
