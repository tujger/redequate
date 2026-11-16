import {getCurrentUserData} from "../controllers/useCurrentUserData";

const normalize = (value, ancestors) => {
    if (value === undefined) return "[undefined]";
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "symbol" || typeof value === "function") return String(value);
    if (value === null || typeof value !== "object") return value;
    if (ancestors.has(value)) return "[Circular]";
    ancestors.add(value);
    try {
        if (value instanceof Date) return value.toISOString();
        const keys = value instanceof Error
            ? [...new Set(["name", "message", "stack", ...Object.getOwnPropertyNames(value)])]
            : Object.keys(value);
        const result = Array.isArray(value) ? [] : Object.create(null);
        for (const key of keys) {
            try {
                result[key] = normalize(value[key], ancestors);
            } catch {
                result[key] = "[Unreadable property]";
            }
        }
        return result;
    } finally {
        ancestors.delete(value);
    }
};

const formatConsoleError = args => args.map(value => {
    if (typeof value === "string") return value;
    try {
        return JSON.stringify(normalize(value, new WeakSet()), null, 2);
    } catch {
        return "[Unserializable value]";
    }
}).join("\n");

export default database => {
    const origin = console.error;
    const reportError = error => origin.call(console, error);
    const handler = function (...args) {
        origin.call(console, ...args);
        try {
            if (!args.length) return;
            const message = formatConsoleError(args);
            if (["no such file or directory", "Module not found", "memory access out of bounds"].some(filter => message.includes(filter))) return;

            if (!database) {
                reportError("[Dispatcher] Error was not saved: database is unavailable.");
                return;
            }
            const currentUserData = getCurrentUserData();
            const saving = database.create(["errors", "error_id"], {
                error: message,
                timestamp: database.TIMESTAMP,
                uid: currentUserData?.id || "anonymous"
            });
            Promise.resolve(saving).catch(reportError);
        } catch (error) {
            reportError(error);
        }
    };
    console.error = handler;
    return () => {
        if (console.error === handler) console.error = origin;
    };
};
