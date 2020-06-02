import React from "react";
import Uuid from "react-uuid";

const callQueue = {};

export const installWrapperControl = () => {
    if(hasWrapperControlInterface()) {
        window.wrapperControlCallback = ({id, ...args}) => {
            console.log("[WC] callback", id, JSON.stringify(args));
        }
    }
};

export const hasWrapperControlInterface = () => {
    return !!window.WrapperControlInterface;
}

export const wrapperControlCall = ({method = "log", timeout = 1000, ...args}) => new Promise((resolve, reject) => {
    console.log("[WC] call", method, JSON.stringify(args));
    if(!hasWrapperControlInterface()) {
        reject(new Error("WrapperControlInterface is not defined."));
        return;
    }
    const id = Uuid();
    callQueue[id] = {
        id: Uuid(),
        method: method,
        args: args,
        reject: reject,
        resolve: resolve,
        timeout: timeout
    }
    window.WrapperControlInterface[method](id, args);
    setTimeout(() => {
        reject(new Error("Task failed by timeout"));
        delete callQueue[id];
    }, timeout);
});
