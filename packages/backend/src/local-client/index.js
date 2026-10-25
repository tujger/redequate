import {fail} from "../../../common";
import BackendBase from "../BackendBase";

const workerError = (code, message) => Object.assign(new Error(message), {code});

export default class LocalBackendClient extends BackendBase {
    #run;
    #ready;

    constructor() {
        super();
        globalThis.addEventListener?.("pagehide", () => this.#stop());
        globalThis.addEventListener?.("pageshow", () => this.#start());
        this.#start();
    }

    #start() {
        if (this.#run) return this.#ready;
        const run = {worker: undefined, cancel: undefined};
        this.#run = run;
        this.#ready = new Promise((resolve, reject) => {
            let cleanup;
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                cleanup?.();
                run.cancel = undefined;
                if (error) {
                    run.worker?.terminate();
                    if (this.#run === run) this.#run = undefined;
                    reject(error.code?.startsWith("backend/")
                        ? error
                        : workerError("backend/worker-unavailable", "Local Server worker failed to start."));
                } else resolve();
            };
            run.cancel = () => finish(workerError("backend/stopped", "Local Server worker was stopped."));
            import("redequate/backend/local-server").then(({default: startLocalServer}) => {
                if (this.#run !== run) return;
                const worker = startLocalServer();
                run.worker = worker;
                const onMessage = ({data}) => {
                    if (data?.type === "ready") finish();
                };
                const onError = event => {
                    event.preventDefault();
                    finish(workerError("backend/worker-unavailable", event.message || "Local Server worker failed to load."));
                };
                cleanup = () => {
                    worker.removeEventListener("message", onMessage);
                    worker.removeEventListener("error", onError);
                    worker.removeEventListener("messageerror", onError);
                };
                worker.addEventListener("message", onMessage);
                worker.addEventListener("error", onError);
                worker.addEventListener("messageerror", onError);
            }).catch(finish);
        });
        this.#ready.catch(() => {});
        return this.#ready;
    }

    #stop() {
        const run = this.#run;
        if (!run) return;
        this.#run = undefined;
        if (run.cancel) run.cancel();
        else run.worker?.terminate();
    }

    async request() {
        fail("backend/not-implemented", "request is not implemented yet.");
    }
}
