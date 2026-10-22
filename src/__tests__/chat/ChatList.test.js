/* eslint react/prop-types: off */
import React, {act} from "react";
import {Provider} from "react-redux";
import {createStore} from "redux";
import {vi} from "vitest";
import {render, unmount} from "../render";
import ChatList from "../../chat/ChatList";

const state = vi.hoisted(() => ({database: null, intersect: null}));
vi.mock("../../controllers", () => ({useDatabase: () => state.database}));
vi.mock("../../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../../chat/ChatItem", () => ({
    default: ({data, skeleton, textComponent}) => skeleton
        ? <span>loading</span>
        : <span data-chat-message>{textComponent(data.text)}</span>
}));
vi.mock("react-intersection-observer", () => ({
    InView: ({onChange, children}) => {
        state.intersect = onChange;
        return <div>{children}</div>;
    }
}));

const row = (key, text = key) => ({key, value: {text}});
const settle = async () => act(async () => { await Promise.resolve(); });

function setup(entries = [], deferred = false) {
    let offset = 0;
    let release;
    const cursor = {
        id: "chat-one",
        order: "desc",
        position: {index: -1, finished: false},
        next: vi.fn(async n => {
            if (deferred) {
                deferred = false;
                await new Promise(resolve => { release = resolve; });
            }
            const page = entries.slice(offset, offset + n);
            offset += page.length;
            cursor.position = {index: offset - 1, key: page.at(-1)?.key, finished: offset === entries.length};
            return page;
        }),
        subscribe: vi.fn(callback => {
            let active = true;
            const subscription = {
                emit: event => active && callback(event),
                unsubscribe: vi.fn(() => { active = false; }),
            };
            return subscription;
        }),
    };
    const database = {cursor: vi.fn(() => cursor)};
    state.database = database;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const store = createStore((state = {}) => state);
    const mount = () => render(React.createElement(Provider, {store},
        React.createElement(ChatList, {chatKey: "one", chatMeta: {}, textComponent: text => text})), container);
    const load = async () => act(async () => { state.intersect(true); });
    const messages = () => [...container.querySelectorAll("[data-chat-message]")].map(node => node.textContent);
    const cleanup = () => { unmount(container); container.remove(); };
    return {
        cursor,
        database,
        container,
        mount,
        load,
        messages,
        cleanup,
        release: () => release(),
        get subscription() { return cursor.subscribe.mock.results[0].value; }
    };
}

afterEach(() => { state.intersect = null; });

it("pages messages by descending key and omits metadata from the rendered list", async () => {
    const rows = Array.from({length: 120}, (_, i) => row(`m${String(119 - i).padStart(3, "0")}`));
    const model = setup([...rows, row("!meta", "metadata")]);
    try {
        model.mount();
        expect(model.cursor.next).not.toHaveBeenCalled();
        await model.load();
        expect(model.database.cursor).toHaveBeenCalledExactlyOnceWith(
            ["chats", {chat_id: "one"}, "message_id"], {order: "desc"}
        );
        expect(model.cursor.next).toHaveBeenCalledExactlyOnceWith(100);
        expect(model.messages()).toEqual(rows.slice(0, 100).map(entry => entry.key));
        await model.load();
        expect(model.messages()).toEqual(rows.map(entry => entry.key));
        expect(model.cursor.next.mock.calls).toEqual([[100], [100]]);
        expect(model.cursor.position.finished).toBe(true);
        expect(model.container.textContent).not.toContain("metadata");
    } finally { model.cleanup(); }
});

it("applies cursor additions, changes and removals without fetching a forward cursor", async () => {
    const model = setup([row("b"), row("a")]);
    try {
        model.mount();
        await model.load();
        await act(async () => {
            await model.subscription.emit({type: "add", entry: row("c")});
            await model.subscription.emit({type: "add", entry: row("c")});
        });
        expect(model.messages()).toEqual(["c", "b", "a"]);
        await act(async () => model.subscription.emit({type: "change", entry: row("a", "edited")}));
        await act(async () => model.subscription.emit({type: "remove", entry: row("b")}));
        expect(model.messages()).toEqual(["c", "edited"]);
        expect(model.database.cursor).toHaveBeenCalledOnce();
        expect(model.cursor.next).toHaveBeenCalledOnce();
    } finally { model.cleanup(); }
    expect(model.subscription.unsubscribe).toHaveBeenCalledOnce();
});

it("renders a live addition after an initially empty chat", async () => {
    const model = setup();
    try {
        model.mount();
        await model.load();
        expect(model.messages()).toEqual([]);
        await act(async () => model.subscription.emit({type: "add", entry: row("first")}));
        expect(model.messages()).toEqual(["first"]);
        expect(model.cursor.next).toHaveBeenCalledOnce();
    } finally { model.cleanup(); }
});

it("does not overlap page requests while the current page is pending", async () => {
    const model = setup([row("first")], true);
    try {
        model.mount();
        await model.load();
        await model.load();
        await model.load();
        expect(model.cursor.next).toHaveBeenCalledOnce();
        await act(async () => { model.release(); });
        expect(model.messages()).toEqual(["first"]);
    } finally { model.cleanup(); }
});

it("does not request another page after reaching the end", async () => {
    const model = setup([row("first")]);
    try {
        model.mount();
        await model.load();
        await model.load();
        expect(model.messages()).toEqual(["first"]);
        expect(model.cursor.next).toHaveBeenCalledOnce();
    } finally { model.cleanup(); }
});

it("ignores a pending page after unmount and unsubscribes", async () => {
    const model = setup([row("late")], true);
    model.mount();
    await model.load();
    model.cleanup();
    await act(async () => { model.release(); });
    await settle();
    expect(model.container.textContent).toBe("");
    expect(model.subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(model.cursor.next).toHaveBeenCalledOnce();
});
