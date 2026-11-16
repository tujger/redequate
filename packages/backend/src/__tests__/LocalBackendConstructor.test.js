import LocalBackend from "../local/LocalBackend";
import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";

it("uses local defaults without installing provider dependencies", () => {
    const backend = new LocalBackend();
    expect(backend.storageId).toBe(LOCAL_DATABASE_NAME);
    expect(backend.projectTitle).toBe("Redequate");
    expect(backend.projectUrl).toBe(globalThis.location?.origin ?? "");
    expect(backend.storage).toBeUndefined();
});

it("forwards superclass settings and isolates the local namespace", () => {
    const backend = new LocalBackend({storageId: "constructor-test", projectTitle: "App", projectUrl: "https://app.test"});
    expect(backend.storageId).toBe("constructor-test");
    expect(backend.projectTitle).toBe("App");
    expect(backend.projectUrl).toBe("https://app.test");
});

it.each([{}, {projectUrl: undefined}, {projectUrl: ""}])("preserves URL default semantics for %j", options => {
    const backend = new LocalBackend(options);
    expect(backend.projectUrl).toBe(options.projectUrl === undefined ? globalThis.location?.origin ?? "" : options.projectUrl);
});

it.each(["", "  ", null, 42])("rejects invalid storageId %j", storageId => {
    expect(() => new LocalBackend({storageId})).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
});
