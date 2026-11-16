import React from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";

import ChatsDaemon from "../../chat/ChatsDaemon";

const state = vi.hoisted(() => ({database: null, fetch: vi.fn(), dispatch: vi.fn(), request: vi.fn(), notify: vi.fn(), put: vi.fn()}));
vi.mock("react-redux", () => ({useDispatch: () => state.dispatch}));
vi.mock("react-router-dom", () => ({useHistory: () => ({push: vi.fn()}), matchPath: () => null}));
vi.mock("../../controllers", () => ({useBackend: () => ({request: state.request}), useDatabase: () => state.database}));
vi.mock("../../controllers/General", () => ({
    cacheDatas: {put: state.put},
    MenuBadge: {INCREASE: "increase", DECREASE: "decrease"},
    usePages: () => ({chat: {route: "/chat/", _route: "/chat/:id"}, chats: {}})
}));
vi.mock("../../controllers/useCurrentUserData", () => ({useCurrentUserDataValue: () => ({id: "me"})}));
vi.mock("../../controllers/notifySnackbar", () => ({default: state.notify}));
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
            ["_chats", {user_id: "me"}, "chat_id"],
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


it.each([undefined, {}, {uid: ""}, {uid: null}, {uid: 1}])("ignores empty or authorless last messages: %j", async lastMessage => {
    const watch = vi.fn(), remove = vi.fn();
    state.fetch.mockReset().mockResolvedValue({lastMessage, watch});
    for (const mock of [state.dispatch, state.request, state.notify, state.put]) mock.mockClear();
    let callbacks;
    state.database = {addEventListener: vi.fn((_path, options) => { callbacks = options; return {remove}; })};
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
        render(React.createElement(ChatsDaemon), container);
        await callbacks.onChildAdd({key: "empty", value: {}});
        await callbacks.onChildChange({key: "empty", value: {timestamp: 1}});
        expect(state.fetch).toHaveBeenCalledTimes(2);
        expect(state.dispatch).not.toHaveBeenCalled();
        expect(state.request).not.toHaveBeenCalled();
        expect(state.notify).not.toHaveBeenCalled();
        expect(state.put).not.toHaveBeenCalled();
        expect(watch).not.toHaveBeenCalled();
    } finally { unmount(container); container.remove(); }
    expect(remove).toHaveBeenCalledOnce();
});
