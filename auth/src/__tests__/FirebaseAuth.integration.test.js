import {vi} from "vitest";
import {auth, firebase, emulatorRequest} from "../../../src/__tests__/common";

it("registers and restores users through the Firebase Auth adapter", async () => {
    const {user} = await auth.createUserWithEmailAndPassword("adapter@example.test", "password");
    expect((await auth.resolveCurrentUser()).uid).toBe(user.uid);
    expect(auth.from(user.toJSON())).toMatchObject({id: user.uid, public: {email: user.email, provider: "password"}});
    await auth.updateProfile({displayName: "Adapter User", photoURL: "https://example.test/photo"});
    expect(await auth.resolveCurrentUser()).toMatchObject({displayName: "Adapter User"});
    await user.updatePassword("new-password");
    await auth.signOut();
    expect(await auth.resolveCurrentUser()).toBeNull();
    await expect(auth.signInWithEmailAndPassword(user.email, "password")).rejects.toBeDefined();
    expect((await auth.signInWithEmailAndPassword(user.email, "new-password")).user.uid).toBe(user.uid);
});
it("awaits subscription setup and returns a working synchronous unsubscribe", async () => {
    const callback = vi.fn();
    const unsubscribe = await auth.onAuthStateChanged(callback);
    try {
        await vi.waitFor(() => expect(callback).toHaveBeenLastCalledWith(null));
        const {user} = await auth.createUserWithEmailAndPassword("subscriber@example.test", "password");
        await vi.waitFor(() => expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({uid: user.uid})));
        unsubscribe();
        const calls = callback.mock.calls.length;
        await auth.signOut();
        expect(callback).toHaveBeenCalledTimes(calls);
    } finally {
        unsubscribe();
    }
});
it("routes verification, password reset and email-link requests to the emulator", async () => {
    const {user} = await auth.createUserWithEmailAndPassword("mail@example.test", "password");
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
        expect((await auth.signInWithEmailLink(user.email)).user.uid).toBe(user.uid);
    } finally {
        window.history.replaceState(null, "", "/");
    }
    expect(firebase.auth().currentUser.emailVerified).toBe(true);
});
