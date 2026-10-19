export default async function saveCurrentProfile(auth, fields) {
    const user = await auth.resolveCurrentUser({skipDelay: true});
    await auth._saveProfile(user, fields);
}
