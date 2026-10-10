import AuthBase from "../AuthBase";

it("does not expose removed Auth methods", () => {
    expect(new AuthBase()).not.toHaveProperty("from");
    expect(new AuthBase()).not.toHaveProperty("resolveToken");
});
it.each(Object.getOwnPropertyNames(AuthBase.prototype).filter(name => name !== "constructor"))(
    "rejects unsupported async operation %s", async name => {
        const result = new AuthBase()[name]({});
        expect(result).toBeInstanceOf(Promise);
        await expect(result).rejects.toThrow(`Not implemented: ${name}`);
    }
);
it("allows partial overrides while keeping inherited failures", async () => {
    class PartialAuth extends AuthBase {
        async resolveCurrentUser() { return null; }
    }
    expect(await new PartialAuth().resolveCurrentUser()).toBeNull();
    await expect(new PartialAuth().signOut()).rejects.toThrow("Not implemented: signOut");
});
