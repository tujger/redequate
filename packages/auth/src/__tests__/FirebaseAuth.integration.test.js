import {vi} from "vitest";
import {auth, firebase, emulatorRequest} from "../../../../src/__tests__/common";

it("registers and restores users through the Firebase Auth adapter", async () => {
    const user = await auth.createUserWithEmailAndPassword("adapter@example.test", "password");
    expect((await auth.resolveCurrentUser()).id).toBe(user.id);
    expect(user).toMatchObject({id: user.id, _userData: true, public: {email: user.email, provider: "password"}});
    expect(user).not.toHaveProperty("user");
    expect(auth).not.toHaveProperty("resolveToken");
    expect(user).not.toHaveProperty("updatePassword");
    expect(user).not.toHaveProperty("uid");
    await auth.updateProfile({displayName: "Adapter User", photoURL: "https://example.test/photo"});
    expect(await auth.resolveCurrentUser()).toMatchObject({name: "Adapter User"});
    await auth.updatePassword("new-password");
    await auth.signOut();
    expect(await auth.resolveCurrentUser()).toBeNull();
    await expect(auth.updatePassword("password")).rejects.toMatchObject({code: "auth/no-current-user"});
    await expect(auth.signInWithEmailAndPassword(user.email, "password")).rejects.toBeDefined();
    expect((await auth.signInWithEmailAndPassword(user.email, "new-password")).id).toBe(user.id);
});
it("awaits subscription setup and returns a working synchronous unsubscribe", async () => {
    const callback = vi.fn();
    const unsubscribe = await auth.onAuthStateChanged(callback);
    try {
        await vi.waitFor(() => expect(callback).toHaveBeenLastCalledWith(null));
        const user = await auth.createUserWithEmailAndPassword("subscriber@example.test", "password");
        await vi.waitFor(() => expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({id: user.id, _userData: true})));
        unsubscribe();
        const calls = callback.mock.calls.length;
        await auth.signOut();
        expect(callback).toHaveBeenCalledTimes(calls);
    } finally {
        unsubscribe();
    }
});
it("routes verification, password reset and email-link requests to the emulator", async () => {
    const user = await auth.createUserWithEmailAndPassword("mail@example.test", "password");
    await auth.sendEmailVerification();
    await auth.sendPasswordResetEmail(user.email);
    await auth.sendSignInLinkToEmail(user.email);
    const {oobCodes} = await emulatorRequest("oobCodes");
    expect(oobCodes).toEqual(expect.arrayContaining([
        expect.objectContaining({email: user.email, requestType: "VERIFY_EMAIL"}),
        expect.objectContaining({email: user.email, requestType: "PASSWORD_RESET"}),
        expect.objectContaining({email: user.email, requestType: "EMAIL_SIGNIN"})
    ]));
    const link = oobCodes.find(code => code.requestType === "EMAIL_SIGNIN").oobLink;
    window.history.replaceState(null, "", `/?${new URL(link).searchParams.toString()}`);
    try {
        expect(await auth.checkSignInWithEmailLink()).toBe(true);
        await auth.signOut();
        expect((await auth.signInWithEmailLink(user.email)).id).toBe(user.id);
    } finally {
        window.history.replaceState(null, "", "/");
    }
    expect(firebase.auth().currentUser.emailVerified).toBe(true);
});
