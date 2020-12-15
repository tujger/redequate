import React from "react";

const DeviceUUID = require("device-uuid");

export const fetchDeviceId = () => {
    if (!window.localStorage.getItem("device_id")) {
        const uuid = new DeviceUUID.DeviceUUID().get();
        window.localStorage.setItem("device_id", uuid);
    }
    return window.localStorage.getItem("device_id");
};

export const delay = millis => new Promise((resolve) => {
    setTimeout(() => {
        resolve();
    }, millis);
})

let firebaseInstance;
let pagesInstance;
let storeInstance = {};
let windowDataInstance = {};
let metaInfoInstance;

export const useFirebase = firebase => {
    if (firebase) firebaseInstance = firebase;
    return firebaseInstance;
}

export const usePages = (() => {
    let pagesInstance;
    return pages => {
        if (pages) pagesInstance = pages;
        return pagesInstance;
    }
})();

export const useStore = initial => {
    if (initial) storeInstance = initial || {};
    return storeInstance;
}

export const useWindowData = initial => {
    if (initial) windowDataInstance = initial || {};
    return windowDataInstance;
}

export const useMetaInfo = (initial) => {
    if (initial instanceof Function) {
        metaInfoInstance = initial(metaInfoInstance);
    } else if (initial) metaInfoInstance = initial || {};
    return metaInfoInstance;
}

export const enableDisabledPages = () => {
    let enabled = 0;
    try {
        for (const x in pagesInstance) {
            const page = pagesInstance[x];
            if (page.disabled) {
                console.log(`[General] enable page ${x}`);
                page.disabled = false;
                enabled++;
            }
        }
    } catch (e) {
        console.error(e);
    }
    return enabled;
}

const CacheDatas = function () {
    let _cache = {};
    let _count = 0;
    let _max = 1000;
    const _body = {
        get length() {
            return _count;
        },
        get max() {
            return _max;
        },
        set max(length) {
            _max = length;
            if (_count > _max) {
                _count = 1;
                _cache = {};
            }
        },
        clear: () => {
            _count = 1;
            _cache = {};
        },
        get: id => {
            return _cache[id];
        },
        fetch: async (id, resolveData) => {
            let cached = _body.get(id);
            if (cached) return cached;
            cached = await resolveData(id);
            if (!cached) return null;
            return _body.put(id, cached);
        },
        put: (id, data) => {
            if (!id) throw new Error("[Cache] data id is not defined");
            if (_cache[id]) {
                return _cache[id];
            }
            if (!data) throw new Error("[Cache] data is not defined");
            _count++;
            if (_count > _max) {
                _count = 1;
                _cache = {};
            }
            let result;
            if (data instanceof Function) {
                result = data();
            } else {
                result = data;
            }
            _cache[id] = result;
            return result;
        },
        remove: id => {
            delete _cache[id];
            _count--;
        },
    };
    return _body;
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
