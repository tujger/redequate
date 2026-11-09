import React, {act} from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";
import ChatItem from "../../chat/ChatItem";

const state = vi.hoisted(() => ({fetch: vi.fn(), notify: vi.fn(), database: {}}));
vi.mock("../../controllers", () => ({
    useCurrentUserDataValue: () => ({id: "me"}),
    useDatabase: () => state.database,
    toDateString: () => "time",
    notifySnackbar: state.notify,
    UserData: class {
        static IMAGE = "image";
        static NAME = "name";
        async fetch(uid, fields) { await state.fetch(uid, fields); this.id = uid; }
    }
}));
vi.mock("../../components/AvatarView", () => ({default: () => <span>avatar</span>}));
vi.mock("../../components/ItemPlaceholderComponent", () => ({default: () => <span>loading</span>}));
vi.mock("../../components/ListItemComponent", () => ({default: ({subtitle}) => <div>{subtitle}</div>}));

let container;
beforeEach(() => {
    state.fetch.mockReset().mockResolvedValue(undefined);
    state.notify.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
});
afterEach(() => { unmount(container); container.remove(); });
const show = props => render(<ChatItem textComponent={text => text} {...props}/>, container);

it.each([undefined, {}, {uid: null}, {uid: ""}, {meta: {members: {me: 0}}, redirect: true}])(
    "omits records without an author and does not load unidentified users: %j", async data => {
        await act(async () => show({data}));
        expect(state.fetch).not.toHaveBeenCalled();
        expect(state.notify).not.toHaveBeenCalled();
        expect(container.textContent).toBe("");
    });

it("keeps the skeleton without fetching a user", () => {
    show({skeleton: true});
    expect(container.textContent).toBe("loading");
    expect(state.fetch).not.toHaveBeenCalled();
});

it("loads an incoming author and renders the message", async () => {
    await act(async () => show({data: {uid: "author", text: "hello", created: 1}}));
    expect(state.fetch).toHaveBeenCalledExactlyOnceWith("author", ["image", "name"]);
    expect(container.textContent).toBe("hello");
    expect(state.notify).not.toHaveBeenCalled();
});

it("renders outgoing messages without fetching the current user", () => {
    show({data: {uid: "me", text: "sent"}});
    expect(container.textContent).toBe("sent");
    expect(state.fetch).not.toHaveBeenCalled();
});
