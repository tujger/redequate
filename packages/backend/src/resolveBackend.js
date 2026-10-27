import {resolvePackage} from "../../common";

let localBackend;
const resolveLocalBackend = () => localBackend ??= import("./local")
    .then(({default: LocalBackend}) => new LocalBackend())
    .catch(error => {
        localBackend = undefined;
        throw error;
    });

export default async backend => resolvePackage(backend, "backend", resolveLocalBackend);
