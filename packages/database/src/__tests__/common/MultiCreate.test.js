import createRecord from "../../common/methods/create";

const backend = () => ({request: vi.fn(async (_name, path) => Object.values(path.at(-1))[0])});
it.each([2, 3])("passes %s generated IDs in path order and substitutes the same IDs into the path", async count => {
    const service = backend();
    const fields = ["first_id", "second_id", "last_id"].slice(3 - count);
    const path = ["records", ...fields];
    const callback = vi.fn((...keys) => ({keys}));
    expect(await createRecord(service, path, callback, {key: "final-key"})).toBe("final-key");
    expect(callback).toHaveBeenCalledTimes(1);
    const keys = callback.mock.calls[0];
    expect(keys).toHaveLength(count);
    expect(new Set(keys).size).toBe(count);
    expect(keys.at(-1)).toBe("final-key");
    expect(keys.slice(0, -1).every(key => /^[-0-9A-Z_a-z]{20}$/.test(key))).toBe(true);
    expect(service.request).toHaveBeenCalledExactlyOnceWith("database.create",
        ["records", ...fields.map((field, index) => ({[field]: keys[index]}))], {keys});
    expect(path).toEqual(["records", ...fields]);
});
it("does not pass supplied segments to the callback", async () => {
    const service = backend();
    const callback = vi.fn((...keys) => ({keys}));
    const path = ["records", {owner_id: "owner"}, "group_id", {container: "fixed"}, "item_id"];
    expect(await createRecord(service, path, callback, {key: "item"})).toBe("item");
    const [group, item] = callback.mock.calls[0];
    expect(callback.mock.calls[0]).toHaveLength(2);
    expect(item).toBe("item");
    expect(service.request).toHaveBeenCalledExactlyOnceWith("database.create",
        ["records", {owner_id: "owner"}, {group_id: group}, {container: "fixed"}, {item_id: "item"}], {keys: [group, item]});
});
it("keeps single-key and fully supplied callbacks compatible", async () => {
    for (const segment of ["id", {id: "manual"}]) {
        const service = backend(); const callback = vi.fn(key => ({key}));
        const expected = typeof segment === "string" ? "generated" : "manual";
        expect(await createRecord(service, ["records", {owner_id: "fixed"}, segment], callback, {key: "generated"})).toBe(expected);
        expect(callback).toHaveBeenCalledExactlyOnceWith(expected);
    }
});
it("returns the final supplied key when only an intermediate key is generated", async () => {
    const service = backend(); const callback = vi.fn(parent => ({parent}));
    expect(await createRecord(service, ["records", "parent_id", {id: "manual"}], callback, {})).toBe("manual");
    expect(callback.mock.calls[0]).toHaveLength(1);
    expect(service.request.mock.calls[0][1][1]).toEqual({parent_id: callback.mock.calls[0][0]});
});
it("generates intermediate IDs for ordinary values and preserves fixed branches", async () => {
    const service = backend(); const value = {text: "unchanged"};
    expect(await createRecord(service, ["records", "parent_id", {edit: "edit"}, "id"], value, {key: "final"})).toBe("final");
    expect(service.request).toHaveBeenCalledExactlyOnceWith("database.create", ["records", {parent_id: expect.stringMatching(/^[-0-9A-Z_a-z]{20}$/)}, {edit: "edit"}, {id: "final"}], value);
});
it("does not request a write when a callback fails or returns an invalid value", async () => {
    const service = backend();
    const error = new Error("callback failed");
    await expect(createRecord(service, ["records", "parent_id", "id"], () => {throw error;}, {key: "last"})).rejects.toBe(error);
    for (const callback of [() => null, async () => ({})]) {
        await expect(createRecord(service, ["records", "parent_id", "id"], callback, {key: "last"})).rejects.toMatchObject({code: "database/invalid-argument"});
    }
    expect(service.request).not.toHaveBeenCalled();
});
