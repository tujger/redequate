import {resolvePackage} from "../../common";

let localBackend;

const resolveLocalBackend = () => {
    if (!localBackend) {
        localBackend = import("./local-client").then(({default: LocalBackendClient}) =>
            new LocalBackendClient()).catch(error => {
            localBackend = undefined;
            throw error;
        });
    }
    return localBackend;
};

export default async backend => resolvePackage(backend, "backend", resolveLocalBackend);
