import {vi} from "vitest";
import PagesCursor from "../../../../src/controllers/PagesCursor";
import {usePages} from "../../../../src/controllers/General";
import FirebaseDatabase from "../firebase";
import {createFirebase} from "./fixtures/firebase";

vi.mock("../../../../src/controllers/General", () => ({usePages: vi.fn()}));
vi.mock("../../../../src/controllers/useCurrentUserData", () => ({getCurrentUserData: () => ({roles: ["reader"]})}));
vi.mock("../../../../src/controllers/UserData", () => ({
    normalizeSortName: name => name.toLowerCase(),
    matchRole: roles => !roles || roles.includes("reader")
}));
beforeEach(() => usePages.mockReturnValue({
    beta: {_route: "/b", route: "/b", title: "Beta"},
    alpha: {_route: "/a", route: "/a", label: "Alpha", roles: ["reader"]},
    private: {_route: "/private", route: "/private", title: "Private", roles: ["admin"]},
    dynamic: {_route: "/dynamic/:id", route: "/dynamic/", title: "Dynamic"}
}));
it.each(["asc", "desc"])("paginates registered pages in %s order and counts a heading once", async order => {
    const cursor = new PagesCursor({group: "Pages", orderBy: "_sort_name", start: "a", end: "z", order});
    const first = await cursor.next(1), second = await cursor.next(1);
    expect(first[0]).toEqual({key: "Pages"});
    expect([...first, ...second].slice(1).map(entry => entry.value.name)).toEqual(order === "asc" ? ["Alpha", "Beta"] : ["Beta", "Alpha"]);
    expect(first[1]).not.toHaveProperty("path");
    await cursor.next();
    expect(cursor.position.finished).toBe(true);
    expect(cursor.count).toBe(3);expect(cursor.position.index).toBe(2);
});
it("composes PagesCursor with Firebase records while keeping group ordering", async () => {
    const fixture = createFirebase();fixture.sdk.once.mockResolvedValue(fixture.snapshot({a: {name: "Record"}}));
    const database = new FirebaseDatabase({firebase: fixture.firebase});
    const cursor = database.cursor([{path: "records", group: "Records"}, new PagesCursor({group: "Pages", start: "alpha", orderBy: "_sort_name"})]);
    const result = await cursor.next(2);
    expect(result.map(entry => "value" in entry ? entry.value.name : entry.key)).toEqual(["Records", "Record", "Pages", "Alpha"]);
    expect(cursor.position.finished).toBe(true);
});

it("uses ready orderBy segments without splitting string fields", async () => {
    usePages.mockReturnValue({
        alpha: {_route: "/a", route: "/a", label: "Alpha", details: {rank: 2}, "details/rank": 1},
        beta: {_route: "/b", route: "/b", label: "Beta", details: {rank: 1}, "details/rank": 2}
    });
    for (const orderBy of [["details", "rank"], ["details", {field: "rank", _: 0}]]) {
        const cursor = new PagesCursor({orderBy, start: 1, end: 2});
        expect((await cursor.next(10)).map(entry => entry.value.name)).toEqual(["Beta", "Alpha"]);
    }
    const cursor = new PagesCursor({orderBy: "details/rank"});
    expect((await cursor.next(10)).map(entry => entry.value.name)).toEqual(["Alpha", "Beta"]);
    for (const orderBy of ["", []]) {
        const root = new PagesCursor({orderBy});
        expect((await root.next(10)).map(entry => entry.value.name)).toEqual(["Alpha", "Beta"]);
    }
});
