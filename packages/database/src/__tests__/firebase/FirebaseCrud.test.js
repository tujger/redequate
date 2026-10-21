import FirebaseDatabase from "../../firebase";
import {createFirebase} from "../fixtures/firebase";

it("creates with generated and supplied keys, computes the value with the final key, and rejects conflicts", async () => {
    const {firebase, sdk} = createFirebase();
    const database = new FirebaseDatabase({firebase});
    expect(await database.create(["posts", "post_id"], key => ({key}))).toBe("generated-1");
    expect(sdk.values.get("posts/generated-1")).toEqual({key: "generated-1"});
    expect(await database.create(["posts", {post_id: "p1"}], key => ({key}))).toBe("p1");
    await expect(database.create(["posts", {post_id: "p1"}], {key: "changed"}))
        .rejects.toMatchObject({code: "database/conflict"});
    expect(sdk.values.get("posts/p1")).toEqual({key: "p1"});
    await expect(database.create(["posts", "post_id"], async () => ({})))
        .rejects.toMatchObject({code: "database/invalid-argument"});
});

it("resolves concurrent generated creates to distinct permanent keys", async () => {
    const {firebase, sdk} = createFirebase();
    const database = new FirebaseDatabase({firebase});
    const keys = await Promise.all(Array.from({length: 8}, () =>
        database.create(["posts", "post_id"], key => ({key}))));
    expect(new Set(keys).size).toBe(8);
    for (const key of keys) expect(sdk.values.get(`posts/${key}`)).toEqual({key});
});

it("merges objects and atomically replaces, creates, deletes, and rolls back callbacks", async () => {
    const {firebase, sdk} = createFirebase();
    const database = new FirebaseDatabase({firebase});
    await database.update("items/a", {name: "A"});
    expect(sdk.update).toHaveBeenCalledWith(expect.objectContaining({path: "items/a"}), {name: "A"});
    sdk.values.set("items/a", {name: "A", retained: true});
    expect(await database.update("items/a", current => ({name: current.name + "!"}))).toEqual({name: "A!"});
    expect(sdk.values.get("items/a")).toEqual({name: "A!"});
    expect(await database.update("items/new", () => ({created: true}))).toEqual({created: true});
    const error = new Error("rollback");
    await expect(database.update("items/a", () => { throw error; })).rejects.toBe(error);
    expect(sdk.values.get("items/a")).toEqual({name: "A!"});
    await expect(database.update("items/a", async () => ({}))).rejects.toMatchObject({code: "database/invalid-argument"});
    expect(await database.update("items/a", () => undefined)).toBeNull();
    expect(sdk.values.has("items/a")).toBe(false);
    expect(await database.update("items/new", () => null)).toBeNull();
    expect(sdk.values.has("items/new")).toBe(false);
    expect(database.write).toBeUndefined();
});
