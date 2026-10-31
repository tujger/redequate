import ActivityListener from "../common/handlers/activity";
import update from "../../../database/src/common/methods/update";

vi.mock("../../../database/src/common/methods/update", () => ({default: vi.fn().mockResolvedValue(null)}));
beforeEach(() => vi.mocked(update).mockClear());
const params = {activity_id: "source"};
const value = {type: "tag.create"};
const options = {orderBy: ["type"], equalTo: "tag.create"};

it.each([
    {first: {type: "tag.create", value: 1}},
    {first: {type: "tag.create", value: 1}, second: {type: "tag.create", value: 2}},
])("updates the ID from the filtered result map instead of reading item.key", async records => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValue(records)};
    await new ActivityListener(backend).onCreate({params, value});
    expect(backend.request).toHaveBeenCalledExactlyOnceWith("database.read", ["_activity", "activity_type_id"], options);
    expect(update).toHaveBeenCalledExactlyOnceWith(backend, ["_activity", {activity_type_id: "first"}],
        {type: "tag.create", value: backend.TIMESTAMP});
});

it.each([null, {}])("creates a record when the filtered result has no entries: %j", async records => {
    const backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn().mockResolvedValueOnce(records).mockResolvedValueOnce("generated")};
    expect(await new ActivityListener(backend).onCreate({params, value})).toBe("generated");
    expect(backend.request.mock.calls).toEqual([
        ["database.read", ["_activity", "activity_type_id"], options],
        ["database.create", ["_activity", "activity_type_id"], {type: "tag.create", value: backend.TIMESTAMP}],
    ]);
    expect(update).not.toHaveBeenCalled();
});
