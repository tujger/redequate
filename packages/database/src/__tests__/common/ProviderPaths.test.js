import parseFirebasePath from "../../firebase/parsePath";
import parseLocalPath from "../../local/parsePath";

for (const [name, parsePath] of [["firebase", parseFirebasePath], ["local", parseLocalPath]]) describe(name, () => {
    it("distinguishes concrete backend addresses from collection queries", () => {
        const path = ["posts", {post_id: "p1"}, "text"];
        expect(parsePath(path).effectivePath).toEqual(path);
        expect(parsePath(path).address).toBe("posts/p1/text");
        expect(parsePath(path).keyField).toBeUndefined();
        expect(parsePath(path, "collection").effectivePath).toEqual(["posts", {post_id: "p1"}]);
        expect(parsePath(path, "collection").keyField).toBe("text");
        expect(parsePath(path, "collection").address).toBe("posts/p1");
    });

    it("keeps literal paths literal for reads and cursor storage lookups", () => {
        const parsed = parsePath("/posts//p1/text", "collection");
        expect(parsed.effectivePath).toBe("/posts//p1/text");
        expect(parsed.address).toBe("posts/p1/text");
        expect(parsed.keyField).toBeUndefined();
    });

    it.each(["", []])("allows root addresses/collections and rejects root creates/listeners: %j", path => {
        expect(parsePath(path).address).toBe("");
        expect(parsePath(path, "collection").address).toBe("");
        for (const mode of ["create", "listener"]) expect(() => parsePath(path, mode)).toThrow();
    });

    it("prepares generated and explicit creation keys without losing literal branches or braces", () => {
        const parent = ["posts", {post_id: "p1"}, "edit"];
        const generated = parsePath([...parent, "edit_id"], "create");
        expect(generated.parentPath).toEqual(parent);
        expect(generated.fieldName).toBe("edit_id");
        expect(generated.key).toBeUndefined();
        const explicit = parsePath([...parent, {edit_id: "{literal}"}], "create");
        expect(explicit.key).toBe("{literal}");
        expect(explicit.fieldName).toBe("edit_id");
        expect(() => parsePath("posts/p1", "create")).toThrow();
    });

    it("keeps input immutable and transport fields serializable", () => {
        const path = Object.freeze(["alerts", Object.freeze({user_id: "u1"}), "alert_id"]);
        const parsed = parsePath(path, "listener");
        expect(JSON.parse(JSON.stringify(parsed.path))).toEqual(path);
        expect(parsed.path).not.toBe(path);
        expect(path).toEqual(["alerts", {user_id: "u1"}, "alert_id"]);
    });

    it.each([["alerts", "user_id", "user_id"], ["alerts", "bad/name"]])("rejects invalid listener parameters: %j", (...path) => {
        expect(() => parsePath(path, "listener")).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
    });

    it("rejects unsupported parser modes", () => {
        expect(() => parsePath(["posts"], "invalid")).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
    });
});

it("formats Firebase wildcard aliases and fixed parameters for native trigger registration", () => {
    const parsed = parseFirebasePath(["alerts", {user_id: "{owner}"}, "alert_id"], "listener");
    expect(parsed.address).toBe("alerts/{owner}/{alert_id}");
    expect(parsed.fixedParams).toEqual({});
    const fixed = parseFirebasePath(["alerts", {user_id: "u1"}, "alert_id"], "listener");
    expect(fixed.address).toBe("alerts/u1/{alert_id}");
    expect(fixed.fixedParams).toEqual({user_id: "u1"});
});

it("prepares Local index captures and keeps store validation specific to Local", () => {
    const path = ["alerts", {user_id: "{owner}"}, "alert_id"];
    expect(parseLocalPath(path, "listener")).toMatchObject({collection: "alerts", pattern: {path, variables: [
        {index: 1, field: "user_id", parameter: "owner"},
        {index: 2, field: "alert_id", parameter: "alert_id"},
    ], params: {}}});
    const fixed = parseLocalPath(["alerts", {user_id: "u1"}, "alert_id"], "listener");
    expect(fixed.pattern.params).toEqual({user_id: "u1"});
    expect(() => parseLocalPath(["$auth"])).toThrow("Invalid application collection");
    expect(parseFirebasePath(["$auth"]).address).toBe("$auth");
});
