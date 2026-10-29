import validatePath from "../../common/validatePath";
import DatabaseCursor from "../../common/DatabaseCursor";

it.each(["", [], "profile/name", ["profile", "name"], ["records", {id: "a"}],
    ["records", {_: "ordinary"}],
    [Object.assign(Object.create(null), {field: "name"})]].map(path => ({path})))(
    "validates without changing the path: %j", ({path}) => {
        const before = structuredClone(path);
        expect(validatePath(path)).toBeUndefined();
        expect(path).toEqual(before);
        expect(new DatabaseCursor({orderBy: path}, path).orderBy).toEqual(path);
    }
);

it.each([undefined, null, 1, {}, [""], [null], [1], [{}], [{id: ""}], [{"": "a"}],
    [{id: "a", second: "b"}], [{id: "a", _: false}], [{id: "a", _: {level: 2}}], [{id: 1}], [{_: true}], [new Date()], new Array(1),
    [Object.assign({id: "a"}, {[Symbol("extra")]: "b"})]].map(path => ({path})))(
    "rejects invalid path formats: %j", ({path}) => {
        expect(() => validatePath(path)).toThrow(expect.objectContaining({code: "database/invalid-argument"}));
    }
);

it("does not modify frozen segments", () => {
    const segment = Object.freeze({field: "name"});
    expect(() => validatePath(Object.freeze(["profile", segment]))).not.toThrow();
});
