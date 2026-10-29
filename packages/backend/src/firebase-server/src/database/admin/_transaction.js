import {fail} from "../../../../../../common";

// Stable value tokens keep conditional writes independent of object property order.
const snapshotETag = value => {
    const encode = value => Array.isArray(value) ? ["array", value.map(encode)]
        : value !== null && typeof value === "object"
            ? ["object", Object.keys(value).sort().map(name => [name, encode(value[name])])]
            : [typeof value, typeof value === "number" ? Object.is(value, -0) ? "-0" : String(value) : value];
    return JSON.stringify(encode(value));
};

export default function _transaction(reference, callback) {
    return reference.transaction(callback, undefined, false);
}

export async function conditionalUpdate(database, address, value, options) {
    const mode = options.mode;
    if (mode !== "read" && mode !== "replace") {
        fail("database/invalid-argument", "Invalid update mode.");
    }
    if (!address) fail("database/invalid-argument", "Conditional updates require a nonempty path.");
    if (mode === "read") {
        if (value !== null) fail("database/invalid-argument", "Read requires a null value.");
        const current = (await database.ref(address).get()).val();
        return {value: current, etag: snapshotETag(current)};
    }
    if (mode === "replace") {
        if (typeof options.etag !== "string" || !options.etag.length || /[\r\n]/.test(options.etag)) {
            fail("database/invalid-argument", "Conditional replacement requires an ETag.");
        }
        const reference = database.ref(address);
        let onValue;
        try {
            // Keep the cache populated until the conditional transaction finishes.
            await new Promise((resolve, reject) => {
                onValue = () => resolve();
                reference.on("value", onValue, reject);
            });
            const {committed, snapshot} = await _transaction(reference,
                current => snapshotETag(current) === options.etag ? value : undefined);
            const current = snapshot.val();
            return committed ? {committed: true, value: current}
                : {committed: false, value: current, etag: snapshotETag(current)};
        } finally {
            reference.off("value", onValue);
        }
    }
}
