import {fail} from "../../../common";
import DatabaseBase from "../common/DatabaseBase";
import addEventListener, {mutate} from "./addEventListener";
import {addRecord, deleteRecord, getRecord, getSubtree, increment, interpretPath, parseDatabasePath, putRecord, TIMESTAMP, updateRecords} from "./helpers";

const invalid = message => fail("database/invalid-argument", message);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

export default class LocalDatabase extends DatabaseBase {
    constructor(options = {}) {
        super(options);
        const {storageKey = "redequate:database:local"} = options;
        if (typeof storageKey !== "string" || !storageKey.trim()) {
            fail("database/invalid-argument", "storageKey must be a non-empty string.");
        }
        this.storageKey = storageKey;
    }

    addEventListener(path, options = {}) {
        return super.addEventListener(path, options,
            callbacks => addEventListener(this.storageKey, path, callbacks));
    }

    create(path, options = {}) {
        return this.run(() => {
            if (!Array.isArray(path) || !path.length || typeof path[0] !== "string" || !path[0]) {
                invalid("create requires a collection path.");
            }
            // A draft adds one generated identity below the supplied collection or record.
            const parent = parseDatabasePath(path, {allowField: false});
            const key = globalThis.crypto.randomUUID();
            const levels = Object.keys(parent?.keys ?? {}).map(name => Number(name.slice(4)));
            const recordPath = [...path, path.length === 1 && path[0] === "posts"
                ? {post_id: key} : {id: key, _: levels.length ? Math.max(...levels) + 1 : 0}];
            return {
                temporaryKey: key,
                save: value => this.run(async () => {
                    if (!isRecord(value)) invalid("value must be a record object.");
                    await mutate(this.storageKey, [recordPath], () => addRecord(this.storageKey, recordPath, value));
                    return key;
                }, options, "create.save", {path, value})
            };
        }, options, "create", {path});
    }

    cursor(path, options = {}) {
        return super.cursor(path, options);
    }

    async delete(path, options = {}) {
        return this.run(() => mutate(this.storageKey, [path], () => parseDatabasePath(path).kind === "collection"
            ? updateRecords(this.storageKey, [[path, null]])
            : deleteRecord(this.storageKey, path)), options, "delete", {path});
    }

    async read(path, options = {}) {
        return this.run(() => {
            if (options?.equalTo !== undefined || options?.orderBy !== undefined) {
                invalid("LocalDatabase does not support read queries.");
            }
            return getRecord(this.storageKey, path);
        }, options, "read", {path, equalTo: options?.equalTo, orderBy: options?.orderBy});
    }

    async readSubtree(path, options = {}) {
        return this.run(() => getSubtree(this.storageKey, path), options, "readSubtree", {path});
    }

    async write(path, value, options = {}) {
        return this.run(() => mutate(this.storageKey, [path], () => parseDatabasePath(path).kind === "collection"
            ? updateRecords(this.storageKey, [[path, value]])
            : value === null ? deleteRecord(this.storageKey, path)
                : putRecord(this.storageKey, path, value)), options, "write", {path, value});
    }

    async update(path, changes, options = {}) {
        const batch = typeof path !== "string" && !Array.isArray(path);
        return this.run(() => mutate(this.storageKey,
            batch ? path instanceof Map ? [...path.keys()] : Object.keys(path ?? {}) : [path], async () => {
            if (batch) {
                if (!(path instanceof Map) && !isRecord(path)) invalid("updates must be a Map or record object.");
                await updateRecords(this.storageKey, path instanceof Map ? [...path] : Object.entries(path));
                return;
            }
            const parsed = parseDatabasePath(path);
            if (parsed.field) invalid("update requires a record path.");
            if (!isRecord(changes)) invalid("changes must be a record object.");
            await updateRecords(this.storageKey, [[path, changes]], {merge: true});
        }), batch ? changes ?? options : options, "update", batch ? {updates: path} : {path, changes});
    }

    get TIMESTAMP() {
        return TIMESTAMP;
    }

    increment(delta) {
        return increment(delta);
    }
}
