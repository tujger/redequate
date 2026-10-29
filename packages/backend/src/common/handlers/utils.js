import {fail} from "../../../../common";
import update from "../../../../database/src/common/methods/update";
import validatePath from "../../../../database/src/common/validatePath";

export const updateCounter = (backend, counterPath, increment) => {
    if (!Array.isArray(counterPath) || !counterPath.length) {
        fail("database/invalid-argument", "Counter path must be a nonempty array.");
    }
    validatePath(counterPath);
    if (typeof increment !== "number" || !Number.isFinite(increment)) {
        fail("database/invalid-argument", "Counter increment must be a finite number.");
    }
    const path = ["_counters", ...counterPath];
    return update(backend, path, value => {
        if (!value || value <= 0) return increment > 0 ? increment : null;
        const next = value + increment;
        return next <= 0 ? null : next;
    });
};
