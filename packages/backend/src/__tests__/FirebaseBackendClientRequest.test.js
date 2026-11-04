import {getFunctions, httpsCallable} from "firebase/functions";
import FirebaseBackendClient from "../firebase-client/FirebaseBackendClient";

vi.mock("firebase/functions", () => ({getFunctions: vi.fn(() => ({})), httpsCallable: vi.fn()}));

it.each([
    [[], undefined],
    [[{userId: "user"}], {userId: "user"}],
    [[["one", "two"]], ["one", "two"]],
    [["path", {value: 1}], ["path", {value: 1}]],
])("preserves callable arguments %j", async (args, payload) => {
    const invoke = vi.fn().mockResolvedValue({data: {result: "ok"}});
    httpsCallable.mockReturnValue(invoke);
    const app = {};
    const backend = new FirebaseBackendClient({firebase: {app}});
    await expect(backend.request("database.update", ...args)).resolves.toEqual({result: "ok"});
    expect(getFunctions).toHaveBeenLastCalledWith(app);
    expect(httpsCallable).toHaveBeenLastCalledWith(getFunctions.mock.results.at(-1).value, "database-update");
    expect(invoke).toHaveBeenCalledExactlyOnceWith(payload);
});

it("propagates callable rejection without changing the error", async () => {
    const failure = new Error("callable failed");
    httpsCallable.mockReturnValue(vi.fn().mockRejectedValue(failure));
    const backend = new FirebaseBackendClient({firebase: {app: {}}});
    await expect(backend.request("notification.send", {})).rejects.toBe(failure);
});
