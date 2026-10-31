import LocalDatabase from "../../../packages/database/src/local";
import LocalBackend from "../../../packages/backend/src/local/LocalBackend";
import onEvents from "../../../packages/backend/src/local/database/onEvents";
import React, {act} from "react";
import {Provider} from "react-redux";
import {createStore} from "redux";
import {Router, Route} from "react-router-dom";
import {createMemoryHistory} from "history";
import {vi} from "vitest";
import {render, unmount} from "../render";
import NewPostComponent from "../../components/NewPostComponent/NewPostComponent";
import LazyListComponent from "../../components/LazyListComponent/LazyListComponent";
import reducer from "../../components/NewPostComponent/newPostComponentReducer";

import FirebaseDatabase from "../../../packages/database/src/firebase";
import {createFirebase} from "../../../packages/database/src/__tests__/fixtures/firebase";

vi.mock("firebase/database", () => import("../../../packages/database/src/__tests__/fixtures/firebase").then(module => module.firebaseDatabaseMock()));

const context = vi.hoisted(() => ({database: undefined, backend: undefined, user: {id: "author"}, storage: {delete: vi.fn().mockResolvedValue(null)}}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value})}));
vi.mock("../../controllers", () => ({
    useAuth: () => ({}), useBackend: () => context.backend, useDatabase: () => context.database, useStorage: () => context.storage
}));
vi.mock("../../controllers/General", () => ({
    usePages: () => ({}), useWindowData: () => ({isNarrow: () => false})
}));
vi.mock("../../controllers/useCurrentUserData", () => ({useCurrentUserDataValue: () => context.user}));
vi.mock("../../controllers/UserData", () => ({matchRole: () => true,
    normalizeSortName: value => value, UserRole: {ADMIN: "ADMIN", USER: "USER"}}));
vi.mock("react-intersection-observer", () => ({
    InView: ({onChange}) => <button data-observer onClick={() => onChange(true)}>Next page</button>
}));
vi.mock("../../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../../pages/admin/audit/auditReducer", () => ({updateActivity: vi.fn()}));
vi.mock("../../components/ProgressView", () => ({default: {SHOW: {type: "show"}, HIDE: {type: "hide"}}}));
vi.mock("../../components/MentionedTextComponent", () => ({tokenizeText: value => [{type: "text", value}]}));
vi.mock("../../components/MentionsInputComponent/MentionsInputComponent", () => ({default: ({onChange}) =>
    <button data-change-text onClick={() => onChange({target: {value: "edited text"}})}>Change text</button>}));
vi.mock("../../components/UploadComponent/UploadComponent", () => ({default: () => null}));
vi.mock("../../components/UploadComponent/uploadComponentControls", () => ({
    uploadComponentClean: vi.fn(), uploadComponentPublish: vi.fn()
}));
vi.mock("../../components/NewPostComponent/Images", () => ({default: ({onChange}) => <>
    <button data-replace-images onClick={() => onChange({images: ["new.jpg"]})}>Replace images</button>
    <button data-remove-images onClick={() => onChange({images: []})}>Remove images</button>
</>}));
vi.mock("../../components/NewPostComponent/Toolbar", () => ({default: ({disabled, onSend}) =>
    <button disabled={disabled} onClick={onSend}>Send</button>}));

let container;
beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
});
afterEach(() => { unmount(container); container.remove(); });

it.each(["local", "firebase"])("releases the composer blocker before navigating after a %s root publication", async provider => {
    const fixture = createFirebase();
    const values = new Map();
    fixture.sdk.once.mockImplementation(ref => {
        const value = values.has(ref.path) ? values.get(ref.path) : Object.fromEntries(
            [...values].filter(([path]) => path.startsWith(`${ref.path}/`))
                .map(([path, value]) => [path.slice(ref.path.length + 1), value]));
        return Promise.resolve(fixture.snapshot(value));
    });
    const storageId = `post-navigation-${crypto.randomUUID()}`;
    context.backend = provider === "local" ? new LocalBackend({storageId}) : {request: vi.fn(async (name, path, value) => {
        expect(name).toBe("database.create");
        expect(path).toEqual(["posts", "post_id"]);
        values.set("posts/backend-key", structuredClone(value));
        return "backend-key";
    })};
    context.database = provider === "local"
        ? new LocalDatabase({storageId, backend: context.backend})
        : new FirebaseDatabase({firebase: fixture.firebase, backend: context.backend});
    const database = context.database;
    if (provider === "local") {
        await database.read(["posts"]);
        vi.spyOn(context.backend, "request");
    }
    const history = createMemoryHistory({initialEntries: ["/discover"]});
    const complete = vi.fn(({key}) => history.push(`/post/${key}`));
    const error = vi.fn();
    const store = createStore((state = {}, action) => ({
        newPostComponentReducer: reducer(state.newPostComponentReducer, action)
    }));
    const transform = vi.fn(async ({value}) => ({children: value.text}));
    const Discover = () => <>
        <NewPostComponent
            buttonComponent={<button>New post</button>}
            onComplete={complete} onError={error} text="root post"
        />
        <LazyListComponent placeholder={<span>Loading</span>} cursor={database.cursor(["posts", "post_id"], {
            equalTo: 0, order: "desc", orderBy: ["to"]
        })} itemTransform={transform}
            ItemComponent={({children}) => <article>{children}</article>} />
    </>;
    await act(async () => render(<Provider store={store}><Router history={history}>
        <Route path="/discover"><Discover/></Route>
        <Route path="/post/:id"><div data-post-page/></Route>
    </Router></Provider>, container));
    await act(async () => container.querySelector("[data-observer]").click());
    expect(container.querySelector("article")).toBeNull();
    await act(async () => [...container.querySelectorAll("button")].find(node => node.textContent === "New post").click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
        [...document.querySelectorAll("button")].find(node => node.textContent === "Send").click();
        await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    });
    const {key} = complete.mock.calls[0][0];
    expect(error).not.toHaveBeenCalled();
    const creates = context.backend.request.mock.calls.filter(([name]) => name === "database.create");
    expect(creates).toEqual([["database.create",
        provider === "local" ? ["posts", {post_id: key}] : ["posts", "post_id"],
        expect.objectContaining({uid: "author", to: 0, text: "root post"})]]);
    expect(await database.read(["posts", {post_id: key}])).toMatchObject({to: 0, text: "root post"});
    expect(history.location.pathname).toBe(`/post/${key}`);
    expect(container.querySelector("[data-post-page]")).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => history.push("/discover"));
    await act(async () => {
        container.querySelector("[data-observer]").click();
        await vi.waitFor(() => expect(transform).toHaveBeenCalledTimes(1));
    });
    expect(container.querySelector("article").textContent).toBe("root post");
});


it("passes a server creation error to onError without completing publication", async () => {
    const failure = Object.assign(new Error("Not allowed"), {code: "functions/permission-denied"});
    context.backend = {request: vi.fn().mockRejectedValue(failure)};
    context.database = new FirebaseDatabase({backend: context.backend});
    const complete = vi.fn();
    const error = vi.fn();
    const history = createMemoryHistory({initialEntries: ["/discover"]});
    const store = createStore((state = {}, action) => ({
        newPostComponentReducer: reducer(state.newPostComponentReducer, action)
    }));
    await act(async () => render(<Provider store={store}><Router history={history}>
        <NewPostComponent buttonComponent={<button>New post</button>}
            onComplete={complete} onError={error} text="root post"/>
    </Router></Provider>, container));
    await act(async () => container.querySelector("button").click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
        [...document.querySelectorAll("button")].find(node => node.textContent === "Send").click();
        await vi.waitFor(() => expect(error).toHaveBeenCalledExactlyOnceWith(failure));
    });
    expect(complete).not.toHaveBeenCalled();
    expect(history.location.pathname).toBe("/discover");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});


const editComposer = async (provider, {failure} = {}) => {
    const oldEdit = Object.freeze({timestamp: 1, uid: "original-editor"});
    const editPostData = {id: "edited-post", text: "old text", images: ["old.jpg"], edit: Object.freeze({old: oldEdit})};
    const initial = {uid: "author", to: 0, text: editPostData.text, images: editPostData.images, edit: editPostData.edit};
    let saved = structuredClone(initial);
    let unsubscribe = () => {};
    const changed = vi.fn();
    if (provider === "local") {
        const storageId = `post-edit-${crypto.randomUUID()}`;
        context.backend = new LocalBackend({storageId});
        context.database = new LocalDatabase({storageId, backend: context.backend});
        await context.database.read(["posts"]);
        await context.backend.request("database.create", ["posts", {post_id: editPostData.id}], initial);
        unsubscribe = onEvents({path: ["posts", "post_id"], onUpdate: changed})(context.backend);
        if (failure) {
            const request = context.backend.request.bind(context.backend);
            vi.spyOn(context.backend, "request").mockImplementation((name, ...args) =>
                name === "database.update" && args[0] === "" ? Promise.reject(failure) : request(name, ...args));
        }
    } else {
        const fixture = createFirebase();
        context.backend = {TIMESTAMP: {".sv": "timestamp"}, request: vi.fn(async (name, path, changes) => {
            expect(name).toBe("database.update");
            expect(path).toBe("");
            if (failure) throw failure;
            const next = structuredClone(saved);
            for (const [path, value] of Object.entries(changes)) {
                const names = path.split("/").slice(2);
                let parent = next;
                for (const name of names.slice(0, -1)) parent = parent[name] ??= {};
                const prepared = JSON.parse(JSON.stringify(value), (_, value) =>
                    value?.[".sv"] === "timestamp" ? Date.now() : value);
                if (prepared === null) delete parent[names.at(-1)];
                else parent[names.at(-1)] = prepared;
            }
            saved = next;
            return null;
        })};
        context.database = new FirebaseDatabase({firebase: fixture.firebase, backend: context.backend});
    }
    const creates = vi.spyOn(context.database, "create");
    const updates = vi.spyOn(context.database, "update");
    const complete = vi.fn(), error = vi.fn();
    const history = createMemoryHistory({initialEntries: ["/post/edited-post"]});
    const store = createStore((state = {}, action) => ({
        newPostComponentReducer: reducer(state.newPostComponentReducer, action)
    }));
    await act(async () => render(<Provider store={store}><Router history={history}>
        <NewPostComponent buttonComponent={<button>Edit post</button>}
            editPostData={editPostData} onComplete={complete} onError={error}/>
    </Router></Provider>, container));
    await act(async () => container.querySelector("button").click());
    await vi.waitFor(() => expect(document.querySelector("[data-change-text]")).not.toBeNull());
    return {editPostData, creates, updates, complete, error, changed, unsubscribe,
        read: () => provider === "local" ? context.database.read(["posts", {post_id: editPostData.id}]) : saved};
};
const sendEdit = async expected => {
    await act(async () => {
        [...document.querySelectorAll("button")].find(node => node.textContent === "Send").click();
        await vi.waitFor(() => expect(expected).toHaveBeenCalledTimes(1));
    });
};

for (const provider of ["local", "firebase"]) {
    it.each([
        ["text", "[data-change-text]", "edited text", ["old.jpg"]],
        ["images", "[data-replace-images]", "old text", ["new.jpg"]],
        ["removed images", "[data-remove-images]", "old text", []],
    ])(`saves %s and history in one ${provider} update`, async (_, selector, text, images) => {
        const editor = await editComposer(provider);
        try {
            await act(async () => document.querySelector(selector).click());
            await sendEdit(editor.complete);
            expect(editor.error).not.toHaveBeenCalled();
            expect(editor.creates).not.toHaveBeenCalled();
            expect(editor.updates).toHaveBeenCalledTimes(1);
            expect(editor.updates.mock.calls[0][0]).toBeInstanceOf(Map);
            expect(editor.updates.mock.calls[0][0].size).toBe(3);
            const saved = await editor.read();
            expect(saved.text).toBe(text);
            expect(saved.images ?? []).toEqual(images);
            expect(saved.edit.old).toEqual({timestamp: 1, uid: "original-editor"});
            const added = Object.keys(saved.edit).filter(key => key !== "old");
            expect(added).toHaveLength(1);
            expect(saved.edit[added[0]]).toEqual({timestamp: expect.any(Number), uid: "author"});
            expect(editor.editPostData.edit).toEqual({old: {timestamp: 1, uid: "original-editor"}});
            if (provider === "local") {
                await vi.waitFor(() => expect(editor.changed).toHaveBeenCalledTimes(1));
                expect(editor.changed.mock.calls[0][0]).toMatchObject({
                    previous: {text: "old text", edit: {old: {timestamp: 1}}},
                    value: {text, edit: saved.edit},
                });
                await vi.waitFor(async () => {
                    const activities = await context.database.read(["activity"]);
                    expect(Object.values(activities ?? {}).filter(item => item.type === "post.update")).toHaveLength(1);
                });
            }
        } finally {editor.unsubscribe();}
    });

    it(`leaves the post and history unchanged when the ${provider} edit fails`, async () => {
        const failure = new Error("Edit rejected");
        const editor = await editComposer(provider, {failure});
        try {
            await act(async () => document.querySelector("[data-change-text]").click());
            await sendEdit(editor.error);
            expect(editor.error).toHaveBeenCalledExactlyOnceWith(failure);
            expect(editor.complete).not.toHaveBeenCalled();
            expect(editor.creates).not.toHaveBeenCalled();
            expect(await editor.read()).toMatchObject({text: "old text", images: ["old.jpg"],
                edit: {old: {timestamp: 1, uid: "original-editor"}}});
            expect(Object.keys((await editor.read()).edit)).toEqual(["old"]);
            expect(editor.editPostData.edit).toEqual({old: {timestamp: 1, uid: "original-editor"}});
            expect(editor.changed).not.toHaveBeenCalled();
            expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        } finally {editor.unsubscribe();}
    });
}
