import validatePath from "../../common/validatePath";
import DatabaseCursor from "../../common/DatabaseCursor";

it.each(["", [], "profile/name", ["profile", "name"], ["records", {id: "a"}],
    ["records", {id: "a", _: false}], ["records", {id: "a", _: {level: 2}}],
    [Object.assign(Object.create(null), {field: "name"})]].map(path => ({path})))(
    "validates without changing the path: %j", ({path}) => {
        const before = structuredClone(path);
        expect(validatePath(path)).toBeUndefined();
        expect(path).toEqual(before);
        expect(new DatabaseCursor({orderBy: path}, path).orderBy).toEqual(path);
    }
);

it.each([undefined, null, 1, {}, [""], [null], [1], [{}], [{id: ""}], [{"": "a"}],
    [{id: "a", second: "b"}], [{id: 1}], [{_: true}], [new Date()], new Array(1),
    [Object.assign({id: "a"}, {[Symbol("extra")]: "b"})]].map(path => ({path})))(
    "rejects invalid path formats: %j", ({path}) => {
        expect(() => validatePath(path)).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
    }
);

it("does not modify frozen segments or read the ignored marker", () => {
    const segment = Object.freeze({field: "name", get _() { throw new Error("Do not read metadata"); }});
    expect(() => validatePath(Object.freeze(["profile", segment]))).not.toThrow();
});
