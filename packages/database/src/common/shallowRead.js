import {fail} from "../../../common";

export function validateShallowRead(options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
        fail("database/invalid-argument", "Read options must be an object.");
    }
    if (options.shallow !== undefined && typeof options.shallow !== "boolean") {
        fail("database/invalid-argument", "shallow must be a boolean.");
    }
    if (options.shallow && ["orderBy", "equalTo", "order", "start", "end", "startDate", "endDate", "limitToFirst", "limitToLast"]
        .some(name => options[name] !== undefined)) {
        fail("database/invalid-argument", "shallow cannot be combined with query options.");
    }
}

export const shallowKeys = value => value !== null && typeof value === "object" ? Object.keys(value) : [];

export function shallowReadUrl(reference, databaseURL, emulatorHost) {
    const url = new URL(reference);
    if (emulatorHost) { url.protocol = "http:"; url.host = emulatorHost; }
    url.pathname = url.pathname.replace(/\/$/, "") + ".json";
    if (databaseURL) {
        const configured = new URL(databaseURL);
        const namespace = configured.searchParams.get("ns");
        if (namespace || (url.protocol === "http:" && url.host !== configured.host)) {
            url.searchParams.set("ns", namespace ?? configured.hostname.split(".")[0]);
        }
    }
    url.searchParams.set("shallow", "true");
    return url;
}

export async function fetchShallowKeys(url, headers) {
    const response = await fetch(url, {headers});
    const value = await response.json();
    if (!response.ok) {
        let code = "unavailable";
        if (response.status === 401 || response.status === 403) code = "permission-denied";
        else if (response.status === 400) code = "invalid-argument";
        fail(`database/${code}`, value?.error ?? `Shallow read failed (${response.status}).`);
    }
    return shallowKeys(value);
}
