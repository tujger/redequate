import ActivityListener from "../common/handlers/activity";
import update from "../../../database/src/common/methods/update";

vi.mock("../../../database/src/common/methods/update", () => ({default: vi.fn().mockResolvedValue(null)}));
beforeEach(() => vi.mocked(update).mockClear());
const params = {activity_id: "source"};
const value = {type: "tag.create"};

it("chooses an existing type ID inside the atomic collection update and preserves unrelated records", async () => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn()};
    await new ActivityListener(backend).onCreate({params, value});
    expect(update).toHaveBeenCalledExactlyOnceWith(backend, ["_activity"], expect.any(Function));
    expect(backend.request).not.toHaveBeenCalled();
    const previous = {
        first: {activity_type_id: "first", type: "tag.create", value: 1},
        other: {activity_type_id: "other", type: "tag.delete", value: 2},
    };
    const prepare = vi.mocked(update).mock.calls[0][2];
    expect(prepare(previous)).toEqual({
        first: {activity_type_id: "first", type: "tag.create", value: backend.TIMESTAMP},
        other: previous.other,
    });
    expect(previous.first.value).toBe(1);
});

it.each([null, {}])("uses the source event ID for an unseen type: %j", async previous => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn()};
    await new ActivityListener(backend).onCreate({params, value});
    const prepare = vi.mocked(update).mock.calls[0][2];
    expect(prepare(previous)).toEqual({
        source: {activity_type_id: "source", type: "tag.create", value: backend.TIMESTAMP},
    });
    expect(backend.request).not.toHaveBeenCalled();
});
