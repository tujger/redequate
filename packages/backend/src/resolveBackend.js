import {resolvePackage} from "../../common";

export const resolveBackend = async backend => resolvePackage(backend, "backend", async () => {
    const {default: LocalTestBackendClient} = await import("./local-test-client");
    return new LocalTestBackendClient();
});
