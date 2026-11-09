vi.mock("../firebase-server/src/common/firebase", () => ({database: {}, messaging: {}}));
vi.mock("../firebase-server/node_modules/firebase-admin/lib/esm/database/index.js", async original => ({
    ...(await original()),
    getDatabase: () => ({ref: path => ({
        child: key => ({key, toString: () => `https://demo.example.test/${path}/${key}`}),
        push: () => ({key: "new", toString: () => `https://demo.example.test/${path}/new`}),
        toString: () => `https://demo.example.test/${path}`,
    })}),
}));
const seen = vi.hoisted(() => []);
vi.mock("../firebase-server/src/common/sendRequest", () => ({default: async props => {
    const {default: backend} = await import("../firebase-server/src/backend");
    seen.push(await backend.getCurrentUser());
    return {...props, response: {ok: true, status: 200, body: {cancel: async () => {}}}};
}}));
vi.mock("../firebase-server/src/common/authorize", () => ({default: async () => {
    const {default: backend} = await import("../firebase-server/src/backend");
    seen.push(await backend.getCurrentUser());
}}));

import backend from "../firebase-server/src/backend";
import create from "../firebase-server/src/database/callable/create";
import update from "../firebase-server/src/database/callable/update";
import deleteRecord from "../firebase-server/src/database/callable/delete";
import notification from "../firebase-server/src/notification/callable";
import email from "../firebase-server/src/email/callable";

beforeEach(() => {
    seen.length = 0;
    vi.stubEnv("FUNCTIONS_EMULATOR", "true");
    vi.spyOn(backend, "request").mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

it.each([
    ["create", create, [["posts", "post_id"], {text: "post"}]],
    ["update", update, [["posts", {post_id: "post"}], {text: "edited"}]],
    ["delete", deleteRecord, ["posts", {post_id: "post"}]],
    ["notification", notification, {uid: "recipient", message: "hello"}],
    ["email", email, {from: "from@example.test", to: "to@example.test", subject: "test", message: "hello"}],
])("scopes the real %s callable entrypoint", async (name, endpoint, data) => {
    await endpoint.run({data, auth: {uid: "caller"}, rawRequest: {headers: {authorization: "Bearer test-token"}}});
    expect(seen).toEqual(["caller"]);
    expect(await backend.getCurrentUser()).toBeUndefined();
});
