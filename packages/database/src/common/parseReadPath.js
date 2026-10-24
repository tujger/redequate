import validatePath from "./validatePath";
import {fail} from "../../../common";

// In array reads the trailing string names the collection's identity field.
// Concrete fields/branches use a named segment, e.g. {email: "email"}.
export default function parseReadPath(rawPath) {
    validatePath(rawPath);
    const path = typeof rawPath === "string"
        ? rawPath.split("/").filter(Boolean)
        : [...rawPath];
    if (!path.length) fail("database/invalid-argument", "read requires a non-empty path.");
    const keyField = Array.isArray(rawPath) && path.length > 1 && typeof path.at(-1) === "string"
        ? path.pop()
        : undefined;
    return {path, keyField, literal: typeof rawPath === "string"};
}
