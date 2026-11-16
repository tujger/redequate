import parsePath, {PATH_VARIABLE} from "../../common/parsePath";
import resolvePath from "../../common/resolvePath";

it("describes every unbound field with the same Symbol while keeping the wire path intact", () => {
    const path = ["alerts", "user_id", "alert_id"];
    expect(parsePath(path)).toEqual({path, literal: false, segments: [
        {name: "alerts", value: "alerts"},
        {name: "user_id", value: PATH_VARIABLE},
        {name: "alert_id", value: PATH_VARIABLE},
    ]});
    expect(typeof PATH_VARIABLE).toBe("symbol");
    expect(parsePath(path).segments[1].value).toBe(parsePath(path).segments[2].value);
    expect(JSON.parse(JSON.stringify(parsePath(path).path))).toEqual(path);
    expect(resolvePath(path)).toBe("alerts/user_id/alert_id");
});

it("preserves fixed values and annotates explicit wildcard aliases", () => {
    const path = ["alerts", {user_id: "u1"}, {alert_id: "{alertId}"}, {field: "new"}];
    expect(parsePath(path)).toEqual({path, literal: false, segments: [
        {name: "alerts", value: "alerts"},
        {name: "user_id", value: "u1"},
        {name: "alert_id", value: PATH_VARIABLE, parameter: "alertId"},
        {name: "field", value: "new"},
    ]});
    expect(resolvePath(path)).toBe("alerts/u1/{alertId}/new");
});

it("keeps literal addresses concrete and normalizes slash separators", () => {
    expect(parsePath("/posts//p1/")).toEqual({path: ["posts", "p1"], literal: true, segments: [
        {name: "posts", value: "posts"}, {name: "p1", value: "p1"},
    ]});
    expect(parsePath("posts/{post_id}").segments[1]).toEqual({name: "post_id", value: PATH_VARIABLE, parameter: "post_id"});
    expect(resolvePath("posts/{post_id}")).toBe("posts/{post_id}");
});

it.each(["", []])("leaves root acceptance to the operation: %j", path => {
    expect(parsePath(path).segments).toEqual([]);
    expect(resolvePath(path)).toBe("");
});

it("does not mutate frozen paths and treats underscore as an ordinary field", () => {
    const segment = Object.freeze({_: "value"});
    const path = Object.freeze(["records", segment]);
    expect(parsePath(path).segments[1]).toEqual({name: "_", value: "value"});
    expect(resolvePath(path)).toBe("records/value");
    expect(path).toEqual(["records", {_: "value"}]);
});

it.each([[null], [["records", {id: "a", _: true}]], [["records", {_: true}]]])(
    "rejects malformed paths including removed metadata: %j", path => expect(() => parsePath(path)).toThrow()
);
