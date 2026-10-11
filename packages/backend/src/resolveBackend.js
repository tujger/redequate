import {resolvePackage} from "../../_common/src/_packages";

export const resolveBackend = async backend => resolvePackage(backend, "backend", async () => {
    const {default: LocalTestBackendClient} = await import("./local-test-client");
    return new LocalTestBackendClient();
});
