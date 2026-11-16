import React, {act} from "react";
import {vi} from "vitest";
import {render, unmount} from "../../render";
import DatabaseCursor from "../../../../packages/database/src/common/DatabaseCursor";
import MutualComponent from "../../../components/MutualComponent/MutualComponent";
import {MutualMode} from "../../../components/MutualComponent/MutualConstants";
import notifySnackbar from "../../../controllers/notifySnackbar";

const context = vi.hoisted(() => ({database: undefined, counter: undefined, incoming: []}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value})}));
vi.mock("react-redux", () => ({useDispatch: () => vi.fn()}));
vi.mock("../../../controllers", () => ({useDatabase: () => context.database}));
vi.mock("../../../controllers/useCurrentUserData", () => ({useCurrentUserDataValue: () => ({id: "me"})}));
vi.mock("../../../controllers/UserData", () => ({matchRole: () => true, UserRole: {ADMIN: "admin", USER: "user"}}));
vi.mock("../../../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../../../controllers/counterControl", () => ({default: ({path, onchange}) => {
    if (path[1] === "mutualrequests") context.counter = onchange;
    return () => {};
}}));
vi.mock("../../../../packages/database/src", async () => ({
    FilteringDatabaseCursor: (await import("../../../../packages/database/src/common/FilteringDatabaseCursor")).default
}));
vi.mock("../../../components/MutualComponent/ActionComponent", () => ({default: ({label}) => <button>{label}</button>}));
vi.mock("../../../components/InfoComponent", () => ({default: ({children}) => <span>{children}</span>}));
vi.mock("../../../components/ConfirmComponent", () => ({default: () => null}));
vi.mock("../../../controls/TextField/TextField", () => ({default: () => null}));
vi.mock("../../../components/ProgressView", () => ({default: {SHOW: "show", HIDE: "hide"}}));
vi.mock("../../../components/MutualComponent/mutualComponentControls", () => ({
    mutualRequest: vi.fn(), mutualRequestAccept: vi.fn(), mutualRequestReject: vi.fn()
}));

class Source extends DatabaseCursor {
    constructor(options, response) { super(options); this.response = response; }
    async next() {
        const entries = await this.response;
        this._position = {...this.position, finished: true};
        return entries;
    }
}
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
};
const request = (uid = "them", message = "incoming") => ({key: message, value: {uid, id: "me", message}});
const settle = async callback => { await act(async () => { callback?.(); }); };
let container;
const show = async (props = {}) => {
    render(<MutualComponent mutualId="them" typeId="friend" mutualMode={MutualMode.DUPLEX_APPROVE} {...props}/>, container);
    await settle();
};

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    context.incoming = [];
    context.counter = undefined;
    notifySnackbar.mockClear();
    context.database = {cursor: vi.fn((_path, options) => {
        const incoming = options.orderBy[0] === "id";
        const response = incoming ? context.incoming.shift() : Promise.resolve([]);
        if (response instanceof Error) throw response;
        return new Source(options, response);
    })};
});
afterEach(() => { unmount(container); container.remove(); });

it("loads the matching incoming request and clears it on an empty result", async () => {
    const first = deferred(), empty = deferred();
    context.incoming.push(first.promise, empty.promise);
    await show();
    await settle(() => first.resolve([request()]));
    expect(container.textContent).toContain("incoming");
    expect(container.textContent).toContain("Mutual.Accept");
    await settle(() => context.counter(1));
    await settle(() => empty.resolve([]));
    expect(container.textContent).not.toContain("Mutual.Accept");
    expect(notifySnackbar).not.toHaveBeenCalled();
    expect(context.database.cursor).toHaveBeenCalledWith(
        ["mutualrequests", {mutual_type: "friend"}, "mutual_id"], {orderBy: ["id"], equalTo: "me"});
});

it("clears a previous request and notifies once when the next load rejects", async () => {
    const first = deferred(), failed = deferred(), error = new Error("load failed");
    context.incoming.push(first.promise, failed.promise);
    await show();
    await settle(() => first.resolve([request()]));
    await settle(() => context.counter(1));
    await settle(() => failed.reject(error));
    expect(container.textContent).not.toContain("incoming");
    expect(container.textContent).not.toContain("Mutual.Accept");
    expect(notifySnackbar).toHaveBeenCalledExactlyOnceWith(error);
});

it("handles synchronous cursor construction errors", async () => {
    const error = new Error("cursor failed");
    context.incoming.push(error);
    await show();
    expect(container.textContent).not.toContain("Mutual.Accept");
    expect(notifySnackbar).toHaveBeenCalledExactlyOnceWith(error);
});

it.each(["resolve", "reject"])("ignores %s after unmount without state updates or notifications", async outcome => {
    const useState = React.useState, updates = vi.fn();
    vi.spyOn(React, "useState").mockImplementation(initial => {
        const [state, setState] = useState(initial);
        return [state, update => { updates(); setState(update); }];
    });
    const pending = deferred();
    context.incoming.push(pending.promise);
    await show();
    unmount(container);
    updates.mockClear();
    await settle(() => pending[outcome](outcome === "resolve" ? [request()] : new Error("late failure")));
    expect(updates).not.toHaveBeenCalled();
    expect(notifySnackbar).not.toHaveBeenCalled();
});

it.each(["mutualId", "requestsCounter"])("keeps the latest result when %s changes and an older response arrives", async trigger => {
    const old = deferred(), latest = deferred();
    context.incoming.push(old.promise, latest.promise);
    await show();
    if (trigger === "mutualId") await show({mutualId: "other"});
    else await settle(() => context.counter(1));
    await settle(() => latest.resolve([request(trigger === "mutualId" ? "other" : "them", "latest")]));
    await settle(() => old.resolve([request("them", "obsolete")]));
    expect(container.textContent).toContain("latest");
    expect(container.textContent).not.toContain("obsolete");
    expect(notifySnackbar).not.toHaveBeenCalled();
});

it("ignores an older rejection after a newer request succeeds", async () => {
    const old = deferred(), latest = deferred();
    context.incoming.push(old.promise, latest.promise);
    await show();
    await settle(() => context.counter(1));
    await settle(() => latest.resolve([request("them", "latest")]));
    await settle(() => old.reject(new Error("obsolete failure")));
    expect(container.textContent).toContain("latest");
    expect(notifySnackbar).not.toHaveBeenCalled();
});
