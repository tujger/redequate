import {resolvePackage} from "../../common";

export default async backend => resolvePackage(backend, "backend", async () => {
    const {default: LocalBackendClient} = await import("./local-client");
    return new LocalBackendClient();
});
