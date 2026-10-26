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
import LocalDatabase from "../../../packages/database/src/local";
import FirebaseDatabase from "../../../packages/database/src/firebase";
import {createFirebase} from "../../../packages/database/src/__tests__/fixtures/firebase";

vi.mock("firebase/database", () => import("../../../packages/database/src/__tests__/fixtures/firebase").then(module => module.firebaseDatabaseMock()));

const context = vi.hoisted(() => ({database: undefined, backend: undefined, user: {id: "author"}}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value})}));
vi.mock("../../controllers", () => ({
    useAuth: () => ({}), useBackend: () => context.backend, useDatabase: () => context.database, useStorage: () => ({})
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
vi.mock("../../components/MentionsInputComponent/MentionsInputComponent", () => ({default: () => null}));
vi.mock("../../components/UploadComponent/UploadComponent", () => ({default: () => null}));
vi.mock("../../components/UploadComponent/uploadComponentControls", () => ({
    uploadComponentClean: vi.fn(), uploadComponentPublish: vi.fn()
}));
vi.mock("../../components/NewPostComponent/Images", () => ({default: () => null}));
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
    fixture.sdk.once.mockImplementation(ref => {
        const values = fixture.sdk.values;
        const value = values.has(ref.path) ? values.get(ref.path) : Object.fromEntries(
            [...values].filter(([path]) => path.startsWith(`${ref.path}/`))
                .map(([path, value]) => [path.slice(ref.path.length + 1), value]));
        return Promise.resolve(fixture.snapshot(value));
    });
    context.database = provider === "local"
        ? new LocalDatabase({storageKey: `post-navigation-${crypto.randomUUID()}`})
        : new FirebaseDatabase({firebase: fixture.firebase});
    const database = context.database;
    context.backend = {request: vi.fn((name, {path, value}) => database.create(path, value))};
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
    expect(context.backend.request).toHaveBeenCalledExactlyOnceWith("database.create", {
        path: ["posts", "post_id"], value: expect.objectContaining({uid: "author", to: 0, text: "root post"})
    });
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
    context.database = {TIMESTAMP: 123};
    context.backend = {request: vi.fn().mockRejectedValue(failure)};
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
