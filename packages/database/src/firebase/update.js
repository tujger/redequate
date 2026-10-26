import {fail} from "../../../common";
import FirebaseBackendClient from "../../../backend/src/firebase-client";
import applyUpdate from "../common/applyUpdate";
import resolvePath from "../common/resolvePath";

export default async function update(firebase, backend, path, changes) {
    const props = prepareUpdate({firebase, backend, path, changes});
    const client = backend ?? new FirebaseBackendClient({firebase});
    if (changes instanceof Function) return updateWithCallback({...props, client});
    await client.request("database.update", props.path, props.changes);
}

const prepareUpdate = props => {
    const {path, changes} = props;
    const batch = typeof path !== "string" && !(path instanceof Array);
    if (!batch) {
        if (changes === undefined) fail("database/invalid-argument", "changes must be provided when path is a string or array.");
        const effectivePath = resolvePath(path);
        if (!(changes instanceof Function)) validateChanges(changes);
        return {...props, path: effectivePath};
    }
    if (path === null || typeof path !== "object") {
        fail("database/invalid-argument", "Batch updates require an object or Map.");
    }
    const entries = path instanceof Map ? [...path] : Object.entries(path);
    const updates = Object.fromEntries(entries.map(([path, value]) => {
        if (value instanceof Function) fail("database/invalid-argument", "Batch updates do not accept callbacks.");
        return [resolvePath(path), value];
    }));
    validateChanges(updates);
    return {...props, path: "", changes: updates};
};

const validateChanges = changes => {
    if (changes === null || typeof changes !== "object" || changes instanceof Array) {
        fail("database/invalid-argument", "changes must be an object.");
    }
};

const readForUpdate = async props => {
    const {client, path} = props;
    const snapshot = await client.request("database.update", path, null, {mode: "read"});
    return {...props, snapshot};
};

const commitUpdate = async props => {
    const {client, path, changes, snapshot} = props;
    const value = applyUpdate(changes, snapshot.value) ?? null;
    const result = await client.request("database.update", path, value, {mode: "replace", etag: snapshot.etag});
    return {...props, snapshot: result};
};

async function updateWithCallback(props) {
    let current = await readForUpdate(props);
    for (let attempt = 0; attempt < 25; attempt++) {
        current = await commitUpdate(current);
        if (current.snapshot.committed) return current.snapshot.value;
        if (attempt < 24) {
            const maximum = Math.min(1000, 25 * 2 ** attempt);
            await new Promise(resolve => setTimeout(resolve, Math.random() * maximum));
        }
    }
    fail("database/conflict", "Update was not committed after 25 attempts.");
}
