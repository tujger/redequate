import React, {act} from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";
import Activity from "../../pages/admin/audit/Activity";

const state = vi.hoisted(() => ({dispatch: vi.fn(), database: {cursor: vi.fn()}, mention: null}));
vi.mock("react-redux", () => ({connect: () => Component => Component, useDispatch: () => state.dispatch}));
vi.mock("../../controllers", () => ({useDatabase: () => state.database, useRedirectToLogin: () => false}));
vi.mock("../../controllers/General", () => ({
    cacheDatas: new Map(), useWindowData: () => ({isNarrow: () => false}), Layout: {},
}));
vi.mock("../../controllers/UserData", () => ({default: class {}}));
vi.mock("../../controllers/mentionTypes", () => ({mentionUsers: {}}));
vi.mock("../../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../../components/LazyListComponent/LazyListComponent", () => ({default: () => null}));
vi.mock("../../pages/admin/audit/ActivityItemComponent", () => ({default: () => null}));
vi.mock("../../components/DateTimePicker/DateTimePicker", () => ({default: () => null}));
vi.mock("../../components/NavigationToolbar", () => ({default: ({children}) => <div>{children}</div>}));
vi.mock("../../components/MentionedSelectComponent", () => ({default: ({mention, onChange}) => {
    state.mention = mention;
    return <button onClick={() => onChange({target: {value: mention.transform({
        key: "service-id", value: {type: "tag.create", value: 123},
    }).id}})}>Choose type</button>;
}}));

describe("Activity type selector", () => {
    let container;
    beforeEach(() => {
        state.dispatch.mockClear();
        state.database.cursor.mockClear();
        state.mention = null;
        container = document.createElement("div");
        document.body.appendChild(container);
    });
    afterEach(() => {unmount(container); container.remove();});

    it("selects and filters by the record type instead of its service key", () => {
        render(<Activity activityMode="type"/>, container);
        expect(state.mention.transform({key: "service-id", value: {type: "tag.create", value: 123}}))
            .toEqual({id: "tag.create", display: "tag.create"});
        state.mention.cursor();
        expect(state.database.cursor).toHaveBeenLastCalledWith(["_activity", "activity_type_id"]);
        act(() => container.querySelector("button").click());
        expect(state.dispatch).toHaveBeenLastCalledWith(expect.objectContaining({activityFilterItem: "tag.create"}));
        render(<Activity activityMode="type" activityFilterItem="tag.create"/>, container);
        expect(state.database.cursor).toHaveBeenLastCalledWith(["activity", "activity_id"],
            expect.objectContaining({orderBy: ["type"], equalTo: "tag.create"}));
        expect(container.textContent).toContain("tag.create");
    });
});
