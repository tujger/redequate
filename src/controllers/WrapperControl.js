import React from "react";
import Uuid from "react-uuid";
import {forceFirebaseReinit} from "./Firebase";

const callQueue = {};

export const installWrapperControl = (firebase) => {
    if(hasWrapperControlInterface()) {
        window.wrapperControlCallback = (message) => {
            console.log(`[WC] message [${message}]`);
            let call;
            try {
                const json = JSON.parse(message);
                const {id, method, args, timestamp, error, status, response = null} = json;
                if(id === "_on_resume") {
                    console.log("[WC] off => on firebase.database triggered");
                    firebase.database().goOffline();
                    firebase.database().goOnline();
                    // console.log("[WC] firebase reinit");
                    // forceFirebaseReinit();
                    return;
                }
                if (!id || !callQueue[id]) {
                    console.error("Failed wrapped call " + id);
                    return;
                }
                call = callQueue[id];
                if (error) {
                    call.reject(new Error(error));
                } else {
                    call.resolve(response);
                }
                delete callQueue[id];
            } catch(error) {
                if(call && call.reject) {
                    call.reject(error);
                } else {
                    console.error(error);
                }
            }
        }
    }
};

export const hasWrapperControlInterface = () => {
    return !!window.WrapperControlInterface;
}

export const wrapperControlCall = ({method = "log", timeout = 1000, ...args}) => new Promise((resolve, reject) => {
    if(!hasWrapperControlInterface()) {
        reject(new Error("WrapperControlInterface is not defined."));
        return;
    }
    if(!window.wrapperControlCallback) {
        reject(new Error("WrapperControl is not installed."));
        console.warn("WrapperControl is not installed, use 'installWrapperControl'.");
        return;
    }
    console.log("[WC] call " + method + " " + JSON.stringify(args));
    const id = Uuid();
    callQueue[id] = {
        id: Uuid(),
        method: method,
        arguments: args,
        reject: reject,
        resolve: resolve,
        timeout: timeout
    }
    window.WrapperControlInterface.postMessage(JSON.stringify({id, method, arguments:args}));
    setTimeout(() => {
        reject(new Error("Task failed by timeout"));
        delete callQueue[id];
    }, timeout);
});
