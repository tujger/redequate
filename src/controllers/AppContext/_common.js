import React from "react";

export const _AppContext = React.createContext(null); // Own data fields are state; getters, methods and private service fields are not.

const frozen = new WeakSet();
const mutableTypes = [
    Date, Map, Set, WeakMap, WeakSet, ArrayBuffer, RegExp,
    ...(typeof SharedArrayBuffer === "undefined" ? [] : [SharedArrayBuffer]),
    ...(typeof URL === "undefined" ? [] : [URL]),
    ...(typeof URLSearchParams === "undefined" ? [] : [URLSearchParams]),
];
const mutableTags = new Set(mutableTypes.map(Type => `[object ${Type.name}]`));
const hasMutableSlots = item => {
    if (ArrayBuffer.isView(item) || mutableTypes.some(Type => item instanceof Type)) return true;

    // Cross-realm built-ins fail instanceof. Inspect tags without calling getters.
    for (let owner = item; owner; owner = Object.getPrototypeOf(owner)) {
        const tag = Object.getOwnPropertyDescriptor(owner, Symbol.toStringTag);
        if (tag) {
            return typeof tag.value === "string" && mutableTags.has(`[object ${tag.value}]`);
        }
    }
    return mutableTags.has(Object.prototype.toString.call(item));
};

export const deepFreeze = value => {
    const seen = new WeakSet();
    const objects = [];
    const pending = [value];

    while (pending.length) {
        const item = pending.pop();
        if (item === null || typeof item !== "object" || frozen.has(item) || seen.has(item)) continue;

        if (hasMutableSlots(item)) {
            throw new TypeError("GlobalStore state cannot contain mutable built-in objects");
        }

        seen.add(item);
        objects.push(item);
        for (const key of Reflect.ownKeys(item)) {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (Object.prototype.hasOwnProperty.call(descriptor, "value")) pending.push(descriptor.value);
        }
    }

    // Validate the complete graph before freezing any of its objects.
    objects.forEach(Object.freeze);
    objects.forEach(item => frozen.add(item));
    return value;
};

export const registry = new Map();
