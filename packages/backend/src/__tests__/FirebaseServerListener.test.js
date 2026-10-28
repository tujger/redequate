import listener from "../firebase-server/src/database/onWrite";
import {extra} from "../common-server";

const event = (before, after, params = {extra_id: "e1"}) => ({
    data: {before: {val: () => before}, after: {val: () => after}}, params,
});

it.each([
    ["/posts//p1/", "posts/p1"],
    [["extra", "extra_id"], "extra/{extra_id}"],
    [["posts", {post_id: "p1"}], "posts/p1"],
    [["posts", {post_id: "{postId}", _: {label: "ignored"}}, {field: "text"}], "posts/{postId}/text"],
    ["posts/{postId}", "posts/{postId}"],
])("registers the database path %j", (path, ref) => {
    const trigger = listener({path, onChange: vi.fn()});
    expect(trigger.__endpoint.eventTrigger).toMatchObject({
        eventType: "google.firebase.database.ref.v1.written",
        eventFilterPathPatterns: {ref, instance: "*"},
    });
});

it.each([[null], [[]], [["posts", {post_id: ""}]], [["posts", {a: "1", b: "2"}]]])(
    "rejects an invalid path %j", path => {
        expect(() => listener({path, onChange: vi.fn()})).toThrow();
    }
);

it.each([
    [null, {text: "created"}],
    [{text: "before"}, {text: "after"}],
    [{text: "deleted"}, null],
])("delivers plain values and preserves the async result", async (before, after) => {
    const onChange = vi.fn(async ({value}) => value);
    const trigger = listener({path: ["extra", "extra_id"], onChange});
    expect(await trigger.run(event(before, after))).toBe(after);
    expect(onChange).toHaveBeenCalledExactlyOnceWith({
        value: after, previousValue: before, params: {extra_id: "e1"},
    });
});

it.each([false, true])("propagates callback errors (async: %s)", async asyncError => {
    const error = new Error("callback failed");
    const onChange = asyncError ? async () => { throw error; } : () => { throw error; };
    const trigger = listener({path: extra.path, onChange});
    await expect((async () => trigger.run(event(null, {})))()).rejects.toBe(error);
});

it.each([
    [null, {type: "like"}],
    [{type: "like"}, {type: "dislike"}],
    [{type: "like"}, null],
])("logs extra changes using the common-server handler", async (before, after) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
        await listener(extra).run(event(before, after));
        expect(log).toHaveBeenCalledExactlyOnceWith("[Extra]", "e1", before, after);
    } finally {
        log.mockRestore();
    }
});
