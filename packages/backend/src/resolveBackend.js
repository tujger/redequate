import {resolvePackage} from "../../_common/src/_packages";

export const resolveBackend = async storage => resolvePackage(storage, "storage", async () => {
    const {LocalTestBackendClient: LocalTestStorage} = await import("./local-test-client");
    return new LocalTestBackendClient();
});
