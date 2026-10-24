import React from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";

const state = vi.hoisted(() => ({database: null, dispatch: vi.fn(), notify: vi.fn()}));
vi.mock("react-redux", () => ({useDispatch: () => state.dispatch}));
vi.mock("react-router-dom", () => ({useHistory: () => ({push: vi.fn()}), matchPath: () => null}));
vi.mock("../../controllers", () => ({useDatabase: () => state.database}));
vi.mock("../../controllers/General", () => ({
    MenuBadge: {INCREASE: "increase", RESET: "reset"},
    usePages: () => ({alerts: {route: "/alerts", _route: "/alerts"}}),
    useStore: () => ({getState: () => ({})})
}));
vi.mock("../../controllers/useCurrentUserData", () => ({useCurrentUserDataValue: () => ({id: "me"})}));
vi.mock("../../controllers/notifySnackbar", () => ({default: state.notify}));

import AlertsDaemon from "../../alerts/AlertsDaemon";

it("handles the first new alert without a consumer-side replay guard", async () => {
    const remove = vi.fn();
    let callbacks;
    state.database = {
        cursor: vi.fn(() => ({count: 0, next: vi.fn().mockResolvedValue([])})),
        addEventListener: vi.fn((path, options) => { callbacks = options;return {remove}; })
    };
    const fetchAlertContent = vi.fn().mockResolvedValue({title: "New", text: "Alert"});
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
        render(<AlertsDaemon fetchAlertContent={fetchAlertContent}/>, container);
        callbacks.onChildAdd({key: "first", value: {id: 1}});
        await vi.waitFor(() => expect(state.notify).toHaveBeenCalledOnce());
        expect(fetchAlertContent).toHaveBeenCalledExactlyOnceWith(
            {database: state.database, pages: {alerts: {route: "/alerts", _route: "/alerts"}}}, {id: 1});
    } finally {
        unmount(container);
        container.remove();
        expect(remove).toHaveBeenCalledOnce();
        state.dispatch.mockClear();
        state.notify.mockClear();
    }
});
