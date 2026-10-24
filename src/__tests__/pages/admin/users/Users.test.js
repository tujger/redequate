import {vi} from "vitest";
import React from "react";
import {render, unmount} from "../../../render";
import Users from "../../../../pages/admin/users/Users";
import FirebaseDatabase from "../../../../../packages/database/src/firebase";
import {createFirebase} from "../../../../../packages/database/src/__tests__/fixtures/firebase";

vi.mock("firebase/database", () => import("../../../../../packages/database/src/__tests__/fixtures/firebase").then(module => module.firebaseDatabaseMock()));

const context = vi.hoisted(() => ({database: undefined, cursor: undefined}));
vi.mock("react-redux", () => ({connect: () => component => component, useDispatch: () => () => {}, useSelector: selector => selector({})}));
vi.mock("../../../../controllers", () => ({
    cacheDatas: {}, useDatabase: () => context.database, useRedirectToLogin: () => false
}));
vi.mock("../../../../controllers/General", () => ({usePages: () => ({})}));
vi.mock("../../../../components/LazyListComponent/LazyListComponent", () => ({default: ({cursor}) => {
    context.cursor = cursor;
    return null;
}}));
vi.mock("../../../../components/FlexFabComponent", () => ({default: () => null}));
vi.mock("../../../../components/LoadingComponent", () => ({default: () => null}));
vi.mock("../../../../components/ProgressView", () => ({default: {HIDE: {type: "hide"}}}));
vi.mock("../../../../pages/admin/users/UserItem", () => ({default: () => null}));
vi.mock("../../../../pages/admin/users/UsersHeader", () => ({default: () => null}));

let container, fixture;
beforeEach(() => {
    container = document.createElement("div");
    fixture = createFirebase();
    context.database = new FirebaseDatabase({firebase: fixture.firebase});
});
afterEach(() => unmount(container));

it("normalizes the name source while preserving the original email prefix", async () => {
    render(<Users filter="ALICE@example.test" invitation={false}/>, container);
    await context.cursor.next(25);
    const queries = fixture.sdk.once.mock.calls.map(([ref]) => ref.query);
    expect(queries).toEqual([
        {orderByChild: ["_sort_name"], startAt: ["aliceexampletest"], endAt: ["aliceexampletest\uf8ff"], limitToFirst: [25]},
        {orderByChild: ["email"], startAt: ["ALICE@example.test"], endAt: ["ALICE@example.test\uf8ff"], limitToFirst: [25]}
    ]);
});
it("does not query emails when the search filter is empty", async () => {
    render(<Users invitation={false}/>, container);
    await context.cursor.next(25);
    expect(fixture.sdk.once).toHaveBeenCalledTimes(1);
    expect(fixture.sdk.once.mock.calls[0][0].query.orderByChild).toEqual(["_sort_name"]);
});
it("restricts active visits to the previous numeric range", async () => {
    render(<Users mode="active" invitation={false}/>, container);
    await context.cursor.next(25);
    expect(fixture.sdk.once.mock.calls[0][0].query).toEqual({
        orderByChild: ["visit"], startAt: [0], endAt: [Number.MAX_SAFE_INTEGER], limitToLast: [25]
    });
});
