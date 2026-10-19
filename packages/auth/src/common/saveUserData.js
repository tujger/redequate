import {isRecord} from "./validateArguments";

const appendUpdates = (updates, path, fields) => {
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        if (isRecord(value)) appendUpdates(updates, [...path, key], value);
        else updates.set([...path, key], value);
    }
};

/** Save only supplied profile fields, never authentication credentials. */
export default async function saveUserData(user, fields, database) {
    const {public: publicData, role, private: privateData} = fields;
    const updates = new Map();
    if (publicData !== undefined) appendUpdates(updates, ["users_public", user.id], publicData);
    if (role !== undefined) updates.set(["roles", user.id], role);
    if (privateData !== undefined) appendUpdates(updates, ["users_private", user.id], privateData);
    if (updates.size) await database.update(updates);
}
