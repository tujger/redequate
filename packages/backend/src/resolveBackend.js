import {resolvePackage} from "../../common";

export const resolveBackend = async backend => resolvePackage(backend, "backend", async () => {
    const {default: LocalBackendClient} = await import("./local-client");
    return new LocalBackendClient();
});
