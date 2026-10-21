import React from "react";
import {act} from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";

const state = vi.hoisted(() => ({database: null, intersect: null}));
vi.mock("../../controllers", () => ({useDatabase: () => state.database}));
vi.mock("../../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../../chat/ChatItem", () => ({default: ({data, skeleton}) =>
    skeleton ? <span>loading</span> : <span>{data.text}</span>}));
vi.mock("react-intersection-observer", () => ({InView: ({onChange, children}) => {
    state.intersect = onChange;
    return <div>{children}</div>;
}}));

import ChatList from "../../chat/ChatList";

const row = (key, created, text = key) => ({key, value: {created, text}});
const settle = async () => {
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

function setup(initial = [], deferFirst = false, deferForward = false) {
    const records = new Map(initial.map(entry => [entry.key, entry]));
    const cursors = [];
    const subscriptions = [];
    let changes;
    let releaseFirst;
    let releaseForward;
    const database = {
        cursor: vi.fn((path, options) => {
            const cursor = {
                options, position: {finished: false}, calls: 0,
                next: vi.fn(async n => {
                    if (deferFirst && cursors.length === 1 && cursor.calls === 0) {
                        await new Promise(resolve => {releaseFirst = resolve;});
                        cursor.calls++;
                        cursor.position.finished = true;
                        return [];
                    }
                    if (deferForward && options.order === "asc" && cursor.calls === 0) {
                        deferForward = false;
                        await new Promise(resolve => {releaseForward = resolve;});
                    }
                    cursor.calls++;
                    const rows = [...records.values()].filter(entry => entry.value.created !== undefined &&
                        (options.start === undefined || entry.value.created >= options.start))
                        .sort((a, b) => options.order === "desc"
                            ? b.value.created - a.value.created : a.value.created - b.value.created);
                    const start = (cursor.calls - 1) * n;
                    cursor.position.finished = start + n >= rows.length;
                    return rows.slice(start, start + n);
                }),
                subscribe: vi.fn(callback => {
                    const subscription = {callback, unsubscribe: vi.fn()};
                    subscriptions.push(subscription);
                    return subscription;
                })
            };
            cursors.push(cursor);
            return cursor;
        }),
        addEventListener: vi.fn((path, callbacks) => {
            changes = callbacks;
            return {remove: vi.fn()};
        })
    };
    state.database = database;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const mount = () => render(<ChatList chatKey="one" chatMeta={{}} textComponent={text => text}/>, container);
    const keys = () => [...container.querySelectorAll("[data-chat-message-key]")]
        .map(node => node.getAttribute("data-chat-message-key"));
    const cleanup = () => {unmount(container); container.remove();};
    return {records, cursors, subscriptions, database, container, mount, keys, cleanup,
        releaseFirst: () => releaseFirst(),
        releaseForward: () => releaseForward(),
        get changes() {return changes;}};
}

afterEach(() => {state.intersect = null;});

it("loads the latest page and pages older messages only at the upward observer", async () => {
    const model = setup(Array.from({length: 120}, (_, i) => row(String(i), i)));
    try {
        await act(async () => {model.mount();});
        await settle();
        expect(model.cursors[0].options).toMatchObject({orderBy: "created", order: "desc"});
        expect(model.cursors[0].next).toHaveBeenCalledExactlyOnceWith(100);
        expect(model.keys()).toHaveLength(100);
        expect(model.keys()[0]).toBe("119");
        await act(async () => {state.intersect(true);});
        expect(model.keys()).toHaveLength(120);
        expect(model.keys().at(-1)).toBe("0");
        expect(model.cursors[0].next).toHaveBeenCalledTimes(2);
    } finally {model.cleanup();}
});

it("fetches forward on arrivals, deduplicates, and keeps both pagination boundaries", async () => {
    const model = setup([row("a", 1), row("b", 2)]);
    try {
        await act(async () => {model.mount();});
        await settle();
        expect(model.keys()).toEqual(["b", "a"]);
        expect(model.cursors[1].options).toMatchObject({orderBy: "created", order: "asc", start: 2});
        model.records.set("c", row("c", 3));
        await act(async () => {model.subscriptions[0].callback({type: "add", entry: row("c", 3)});});
        await settle();
        expect(model.keys()).toEqual(["c", "b", "a"]);
        expect(model.cursors[0].next).toHaveBeenCalledTimes(1);
        expect(model.database.cursor.mock.calls.every(([, options]) => options.orderBy === "created")).toBe(true);
        await act(async () => {model.changes.onChildChange(row("a", 1, "edited"));});
        expect(model.container.textContent).toContain("edited");
        await act(async () => {model.changes.onChildRemove(row("b", 2));});
        expect(model.keys()).toEqual(["c", "a"]);
    } finally {model.cleanup();}
    expect(model.subscriptions[0].unsubscribe).toHaveBeenCalledOnce();
    expect(model.database.addEventListener.mock.results[0].value.remove).toHaveBeenCalledOnce();
});

it("catches an arrival between the first page and subscription, including an empty chat", async () => {
    const model = setup([], true);
    try {
        model.mount();
        model.records.set("a", row("a", 1));
        await act(async () => {model.releaseFirst();});
        await settle();
        expect(model.keys()).toEqual(["a"]);
        expect(model.cursors[0].next).toHaveBeenCalledTimes(1);
    } finally {model.cleanup();}
});

it("preserves the visible anchor when an older page is added", async () => {
    const model = setup(Array.from({length: 101}, (_, i) => row(String(i), i)));
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(() => ({top: model.keys().length > 100 ? 20 : 10, bottom: 30}));
    try {
        await act(async () => {model.mount();});
        await settle();
        await act(async () => {state.intersect(true);});
        expect(model.keys()).toHaveLength(101);
        expect(scrollBy).toHaveBeenCalledWith(0, 10);
    } finally {model.cleanup(); scrollBy.mockRestore(); rect.mockRestore();}
});

it("coalesces rapid arrivals while a forward page is pending", async () => {
    const model = setup([row("a", 1)], false, true);
    try {
        await act(async () => {model.mount();});
        model.records.set("b", row("b", 2));
        model.records.set("c", row("c", 3));
        act(() => {
            model.subscriptions[0].callback({type: "add", entry: row("b", 2)});
            model.subscriptions[0].callback({type: "add", entry: row("c", 3)});
        });
        await act(async () => {model.releaseForward();});
        await settle();
        expect(model.keys()).toEqual(["c", "b", "a"]);
        expect(model.cursors[0].next).toHaveBeenCalledOnce();
    } finally {model.cleanup();}
});

it("ignores a pending page after unmount and removes listeners", async () => {
    const model = setup([row("a", 1)], false, true);
    await act(async () => {model.mount();});
    model.cleanup();
    model.records.set("b", row("b", 2));
    await act(async () => {model.releaseForward();});
    expect(model.subscriptions[0].unsubscribe).toHaveBeenCalledOnce();
    expect(model.database.addEventListener.mock.results[0].value.remove).toHaveBeenCalledOnce();
});
