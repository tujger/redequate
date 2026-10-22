import React from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";

import ChatsDaemon from "../../chat/ChatsDaemon";

const state = vi.hoisted(() => ({database: null, fetch: vi.fn()}));
vi.mock("react-redux", () => ({useDispatch: () => vi.fn()}));
vi.mock("react-router-dom", () => ({useHistory: () => ({push: vi.fn()}), matchPath: () => null}));
vi.mock("../../controllers", () => ({useBackend: () => ({}), useDatabase: () => state.database}));
vi.mock("../../controllers/General", () => ({
    cacheDatas: {put: vi.fn()},
    MenuBadge: {INCREASE: "increase", DECREASE: "decrease"},
    usePages: () => ({chat: {route: "/chat/", _route: "/chat/:id"}, chats: {}})
}));
vi.mock("../../controllers/useCurrentUserData", () => ({useCurrentUserDataValue: () => ({id: "me"})}));
vi.mock("../../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../../chat/ChatMeta", () => ({default: () => ({fetch: state.fetch})}));

it("watches added and changed chat indexes and removes its subscription", async () => {
    const remove = vi.fn();
    let callbacks;
    state.fetch.mockReset().mockResolvedValue({lastMessage: {uid: "me"}});
    state.database = {
        addEventListener: vi.fn((path, options) => { callbacks = options; return {remove}; }),
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
        render(React.createElement(ChatsDaemon), container);
        expect(state.database.addEventListener).toHaveBeenCalledExactlyOnceWith(
            ["_chats", {user_id: "me"}],
            {onChildAdd: expect.any(Function), onChildChange: expect.any(Function)}
        );
        expect(state.fetch).not.toHaveBeenCalled();
        await callbacks.onChildAdd({key: "a", value: {}});
        await callbacks.onChildAdd({key: "b", value: {}});
        await callbacks.onChildChange({key: "a", value: {timestamp: 20}});
        expect(state.fetch.mock.calls.map(([key]) => key)).toEqual(["a", "b", "a"]);
    } finally {
        unmount(container);
        container.remove();
        expect(remove).toHaveBeenCalledOnce();
        state.fetch.mockClear();
    }
});
