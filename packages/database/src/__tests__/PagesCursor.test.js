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
