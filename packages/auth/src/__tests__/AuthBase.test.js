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
])("validates arguments or reports an unsupported operation: %s", async (name, args) => {
    const result = new AuthBase({database: {}})[name](...args);
    if (["checkSignInWithEmailLink", "resolveRedirectResult", "signOut"].includes(name)) {
        await expect(result).rejects.toThrow(`Not implemented: ${name}`);
    } else {
        expect(result).toBeUndefined();
    }
});
it("allows partial overrides while keeping inherited failures", async () => {
    class PartialAuth extends AuthBase {
        async resolveCurrentUser() { return null; }
    }
    expect(await new PartialAuth().resolveCurrentUser()).toBeNull();
    await expect(new PartialAuth().signOut()).rejects.toThrow("Not implemented: signOut");
});
