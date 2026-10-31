import React, {act, useEffect, useState} from "react";
import {IDBFactory} from "fake-indexeddb";
import {vi} from "vitest";
import {render, unmount} from "../render";
import LocalBackend from "../../../packages/backend/src/local/LocalBackend";
import LocalDatabase from "../../../packages/database/src/local";
import Activity from "../../pages/admin/audit/Activity";

const state = vi.hoisted(() => ({dispatch: vi.fn(), database: null}));
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
    const [items, setItems] = useState([]);
    useEffect(() => {
        let active = true;
        if (mention?.cursor) mention.cursor().next(10).then(records => {
            if (active) setItems(records.map(mention.transform));
        });
        return () => {active = false;};
    }, []);
    return <div>{items.map(item => <button key={item.id}
        onClick={() => onChange({target: {value: item.id}})}>{item.display}</button>)}</div>;
}}));

it("selects the original type from real Local Activity records", async () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    const backend = new LocalBackend({storageId: "activity-ui-records"});
    state.database = new LocalDatabase({storageId: "activity-ui-records", backend});
    state.dispatch.mockClear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
        await state.database.read(["_activity"]);
        await state.database.update(["_activity", {activity_type_id: "service-id"}],
            {activity_type_id: "service-id", type: "tag.create", value: 123});
        render(<Activity activityMode="type"/>, container);
        await vi.waitFor(() => expect(container.querySelector("button")?.textContent).toBe("tag.create"));
        await act(async () => container.querySelector("button").click());
        expect(state.dispatch).toHaveBeenLastCalledWith(expect.objectContaining({activityFilterItem: "tag.create"}));
    } finally {
        unmount(container);
        container.remove();
        vi.unstubAllGlobals();
    }
});
