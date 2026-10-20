import {fail} from "../../../common";
import type {DatabasePath} from "./DatabaseTypes";

export default function validatePath(path: unknown): asserts path is DatabasePath {
    if (typeof path === "string") return;
    if (!Array.isArray(path)) {
        fail("database/invalid-argument", "Expected a string or an array of path segments.");
        return;
    }
    for (const segment of path) {
        if (typeof segment === "string" && segment.length) continue;
        if (segment !== null && typeof segment === "object" && !Array.isArray(segment)
            && [Object.prototype, null].includes(Object.getPrototypeOf(segment))) {
            const names = Reflect.ownKeys(segment).filter(name => name !== "_");
            const name = names[0];
            const value = typeof name === "string" ? segment[name] : undefined;
            if (names.length === 1 && typeof name === "string" && name.length
                && typeof value === "string" && value.length) continue;
        }
        fail("database/invalid-argument", "A path segment must be a non-empty string or have one named non-empty string value.");
    }
}
