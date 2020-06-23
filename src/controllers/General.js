import React from "react";
import {DeviceUUID} from "device-uuid";

export const fetchDeviceId = () => {
    if (!localStorage.getItem("device_id")) {
        const uuid = new DeviceUUID().get();
        localStorage.setItem("device_id", uuid);
    }
    return localStorage.getItem("device_id");
};

let firebaseInstance;
let pagesInstance;
let userDatasInstance = {};
let storeInstance = {};
let windowDataInstance = {};

export const useFirebase = firebase => {
    if(firebase) firebaseInstance = firebase;
    return firebaseInstance;
}

export const usePages = pages => {
    if(pages) pagesInstance = pages;
    // if(pages && pagesInstance) console.warn("Attempted to redefine pages")
    return pagesInstance;
}

export const useUserDatas = initial => {
    if(initial) userDatasInstance = initial || {};
    return userDatasInstance;
}

export const useStore = initial => {
    if(initial) storeInstance = initial || {};
    return storeInstance;
}

export const useWindowData = initial => {
    if(initial) windowDataInstance = initial || {};
    return windowDataInstance;
}
