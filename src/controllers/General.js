import React from "react";
import DeviceUUID from "device-uuid";

export const fetchDeviceId = () => {
    if (!localStorage.getItem("device_id")) {
        const uuid = new DeviceUUID().get();
        localStorage.setItem("device_id", uuid);
    }
    return localStorage.getItem("device_id");
};

let firebaseInstance;
let pagesInstance;
let storeInstance = {};
let windowDataInstance = {};
let technicalInfoInstance;

export const useFirebase = firebase => {
    if(firebase) firebaseInstance = firebase;
    return firebaseInstance;
}

export const usePages = pages => {
    if(pages) pagesInstance = pages;
    // if(pages && pagesInstance) console.warn("Attempted to redefine pages")
    return pagesInstance;
}

export const useStore = initial => {
    if(initial) storeInstance = initial || {};
    return storeInstance;
}

export const useWindowData = initial => {
    if(initial) windowDataInstance = initial || {};
    return windowDataInstance;
}

export const useTechnicalInfo = (initial) => {
    if(initial instanceof Function) {
        technicalInfoInstance = initial(technicalInfoInstance);
    } else if(initial) technicalInfoInstance = initial || {};
    return technicalInfoInstance;
}

const CacheDatas = function() {
    let _cache = {};
    let _count = 0;
    let _max = 1000;
    return {
        get length() {
            return _count;
        },
        get max() {
            return _max;
        },
        set max(length) {
            _max = length;
            if(_count > _max) {
                _count = 1;
                _cache = {};
            }
        },
        get: id => {
            return _cache[id];
        },
        put: (id, data) => {
            if(!id) throw new Error("[Cache] data id is not defined");
            if(_cache[id]) {
                return _cache[id];
            }
            if(!data) throw new Error("[Cache] data is not defined");
            _count++;
            if(_count > _max) {
                _count = 1;
                _cache = {};
            }
            _cache[id] = data;
            return data;
        },
        remove: id => {
            delete _cache[id];
            _count--;
        },
    }
}
export const cacheDatas = new CacheDatas();

export const MenuBadge = {
    INCREASE: "badge_Increase",
    DECREASE: "badge_Decrease",
    RESET: "badge_Reset",
    VALUE: "badge_Value",
}
export const Layout = {
    REFRESH: "layout_Refresh",
    TITLE: "layout_Title",
}

