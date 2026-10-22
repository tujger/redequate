import React from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";

const state = vi.hoisted(() => ({database: null, fetch: vi.fn()}));
vi.mock("react-redux", () => ({useDispatch: () => vi.fn()}));
vi.mock("react-router-dom", () => ({useHistory: () => ({push: vi.fn()}), matchPath: () => null}));
vi.mock("../../controllers", () => ({useBackend: () => ({}), useDatabase: () => state.database}));
vi.mock("../../controllers/General", () => ({
    cacheDatas: {put: vi.fn()}, MenuBadge: {INCREASE: "increase", DECREASE: "decrease"},
    usePages: () => ({chat: {route: "/chat/", _route: "/chat/:id"}, chats: {}})
}));
vi.mock("../../controllers/useCurrentUserData", () => ({useCurrentUserDataValue: () => ({id: "me"})}));
vi.mock("../../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../../chat/ChatMeta", () => ({default: () => ({fetch: state.fetch})}));

import ChatsDaemon from "../../chat/ChatsDaemon";

it("loads existing chats separately and watches later keys without replaying them", async () => {
    const remove = vi.fn();
    let callbacks;
    const next = vi.fn().mockResolvedValueOnce([{key: "a"}, {key: "b"}]);
    state.fetch.mockResolvedValue({lastMessage: {uid: "me"}});
    state.database = {
        addEventListener: vi.fn((path, options) => { callbacks = options;return {remove}; }),
        cursor: vi.fn(() => ({next}))
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
        render(<ChatsDaemon/>, container);
        await vi.waitFor(() => expect(state.fetch).toHaveBeenCalledTimes(2));
        expect(state.fetch.mock.calls.map(([key]) => key)).toEqual(["a", "b"]);
        expect(state.database.cursor).toHaveBeenCalledExactlyOnceWith(["_chats", {user_id: "me"}]);
        callbacks.onChildAdd({key: "b", value: {}});
        callbacks.onChildAdd({key: "c", value: {}});
        expect(state.fetch.mock.calls.map(([key]) => key)).toEqual(["a", "b", "c"]);
    } finally {
        unmount(container);
        container.remove();
        expect(remove).toHaveBeenCalledOnce();
        state.fetch.mockClear();
    }
});
