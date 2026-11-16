import AuthBase from "../AuthBase";

it("does not expose removed Auth methods", () => {
    expect(new AuthBase()).not.toHaveProperty("from");
    expect(new AuthBase()).not.toHaveProperty("resolveToken");
    expect(new AuthBase()).not.toHaveProperty("resolveUser");
});
it.each([
    ["checkSignInWithEmailLink", []],
    ["createUserWithEmailAndPassword", ["user@example.test", "password"]],
    ["onAuthStateChanged", [() => {}]],
    ["resolveRedirectResult", []],
    ["resolveCurrentUser", []],
    ["sendEmailVerification", []],
    ["sendPasswordResetEmail", ["user@example.test"]],
    ["sendSignInLinkToEmail", ["user@example.test"]],
    ["signInWithEmailAndPassword", ["user@example.test", "password"]],
    ["signInWithPopup", ["google.com"]],
    ["signInWithRedirect", ["google.com"]],
    ["signInWithCredential", ["token"]],
    ["signInWithEmailLink", ["user@example.test"]],
    ["signOut", []],
    ["updatePassword", ["password"]],
    ["updateProfile", [{public: {name: "Name"}}]],
])("validates arguments or reports an unsupported operation: %s", async (name, args) => {
    const auth = new AuthBase();
    auth.setDatabase({});
    const result = auth[name](...args);
    expect(result).toBeInstanceOf(Promise);
    if (["checkSignInWithEmailLink", "resolveRedirectResult", "signOut"].includes(name)) {
        await expect(result).rejects.toThrow(`Not implemented: ${name}`);
    } else {
        await expect(result).resolves.toBeUndefined();
    }
});
it("allows partial overrides while keeping inherited failures", async () => {
    class PartialAuth extends AuthBase {
        async resolveCurrentUser() { return null; }
    }
    expect(await new PartialAuth().resolveCurrentUser()).toBeNull();
    await expect(new PartialAuth().signOut()).rejects.toThrow("Not implemented: signOut");
});

it.each([
    ["createUserWithEmailAndPassword", [null, "password"]],
    ["onAuthStateChanged", [null]],
    ["resolveCurrentUser", [null]],
    ["sendEmailVerification", [null]],
    ["sendPasswordResetEmail", [42]],
    ["sendSignInLinkToEmail", [false]],
    ["signInWithEmailAndPassword", ["user", null]],
    ["signInWithPopup", [null]],
    ["signInWithRedirect", [[]]],
    ["signInWithCredential", [null]],
    ["signInWithEmailLink", [undefined]],
    ["updatePassword", [42]],
    ["updateProfile", [null]],
])("rejects invalid %s arguments through async supermethods", async (name, args) => {
    const auth = new AuthBase();
    auth.setDatabase({});
    let result;
    expect(() => { result = auth[name](...args); }).not.toThrow();
    await expect(result).rejects.toMatchObject({code: "auth/invalid-argument"});
});
