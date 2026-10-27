import {fail} from "../../../common";

export default function applyUpdate(callback, value) {
    const updated = callback(structuredClone(value));
    if (updated?.then instanceof Function) {
        Promise.resolve(updated).catch(() => {});
        fail("database/invalid-argument", "update callback must be synchronous.");
    }
    return updated;
}
