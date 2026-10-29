import {vi} from "vitest";

// Controlled responses only; persistence and conflict handling have their own backend tests.
export function createBackend() {
    return {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn(async (name, _path, value, options) => {
        if (name === "database.create") return "backend-key";
        if (name === "database.delete") return null;
        if (name === "database.update") {
            if (options?.mode === "read") return {value: null, etag: "initial"};
            if (options?.mode === "replace") return {committed: true, value};
            return null;
        }
        throw new Error(`Unexpected backend request: ${name}`);
    })};
}
