import {encodeRole} from "./roleData";
import {isRecord} from "./validateArguments";

const appendUpdates = (updates, path, fields) => {
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) continue;
        const segment = path[0] === "users_private" && path.length === 2 ? {device_id: key} : key;
        if (isRecord(value)) appendUpdates(updates, [...path, segment], value);
        else updates.set([...path, segment], value);
    }
};

/** Save only supplied profile fields, never authentication credentials. */
export default async function saveUserData(user, fields, database, options) {
    const {public: publicData, role, private: privateData} = fields;
    const updates = new Map();
    if (publicData !== undefined) appendUpdates(updates, ["users_public", {user_id: user.id}], publicData);
    if (role !== undefined) updates.set(["roles", {user_id: user.id}], encodeRole(database, user.id, role));
    if (privateData !== undefined) appendUpdates(updates, ["users_private", {user_id: user.id}], privateData);
    if (updates.size) await database.update(updates, options);
}
