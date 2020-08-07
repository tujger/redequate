export {default as fibonacci} from "./fibonacci.worker";

export function WebWorker(worker) {
    if (!window.Worker) return () => new Promise((resolve, reject) => {
        reject(new Error("WebWorkers are not supported"));
    })

    let code = worker.toString();
    code = code.substring(code.indexOf("{") + 1, code.lastIndexOf("}"));

    const blob = new Blob([code], {type: "application/javascript"});
    const _worker = new Worker(URL.createObjectURL(blob));

    return options => new Promise((resolve, reject) => {
        try {
            const listener = (event) => {
                resolve(event.data);
                _worker.removeEventListener("message", listener);
            }
            _worker.addEventListener("message", listener);
            _worker.postMessage(options);
        } catch (error) {
            reject(error);
        }
    })
}
