/* global Worker */
export default function startLocalServer() {
    if (typeof globalThis.Worker !== "function") {
        throw Object.assign(new Error("Local Server requires Web Workers."), {code: "backend/worker-unavailable"});
    }
    return new Worker(new URL("./local-server-worker.mjs", import.meta.url), {type: "module"});
}
