import {fail} from "../../../common";
import {key as pushKey} from "firebase-key";
import DatabaseBase from "../common/DatabaseBase";
import {composeCursor} from "../common/ComposedDatabaseCursor";
import resolvePath from "../common/resolvePath";
import {applyReadOptions, readQueryOptions} from "../common/applyReadOptions";
import parseCreatePath from "../common/parseCreatePath";
import addEventListener, {mutate} from "./addEventListener";
import LocalCursor from "./cursor";
import {addRecord, deleteRecord, getRecord, getSubtree, increment, parseDatabasePath, TIMESTAMP, updateRecord, updateRecords, createRecordPath} from "./helpers";

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

    cursor(path, options = {}) {
        const pathIsDatabasePath = typeof path === "string" || (path instanceof Array &&
            (path.length === 0 || typeof path[0] === "string"));
        const queries = path instanceof Array && !pathIsDatabasePath ? path : [{path}];
        const effective = options === null || typeof options !== "object" || options instanceof Array
            ? options
            : {...options, onError: options.onError ?? this.onError};
        return composeCursor(queries, effective,
            (sourcePath, sourceOptions) => new LocalCursor(this.storageKey, sourcePath,
                {...sourceOptions, onError: sourceOptions?.onError ?? this.onError}),
            this.run.bind(this), path, pathIsDatabasePath ? () => resolvePath(path) : undefined);
    }

    create(path, options = {}) {
        return this.run(() => {
            const {key: suppliedKey} = parseCreatePath(path);
            const key = suppliedKey ?? pushKey();
            const recordPath = createRecordPath(path, key);
            return {
                temporaryKey: key,
                save: value => this.run(async () => {
                    if (value instanceof Function) value = value(key);
                    if (value?.then instanceof Function) {
                        Promise.resolve(value).catch(() => {});
                        invalid("create callback must be synchronous.");
                    }
                    if (!isRecord(value)) invalid("value must be a record object.");
                    await mutate(this.storageKey, [recordPath], () => addRecord(this.storageKey, recordPath, value));
                    return key;
                }, options, "create.save", {path, value})
            };
        }, options, "create", {path});
    }

    async delete(path, options = {}) {
        return this.run(() => mutate(this.storageKey, [path], () => parseDatabasePath(path).kind === "collection"
            ? updateRecords(this.storageKey, [[path, null]])
            : deleteRecord(this.storageKey, path)), options, "delete", {path});
    }

    async read(path, options = {}) {
        if (path === "" || Array.isArray(path) && !path.length) {
            invalid("read requires a non-empty path.");
        }
        return this.run(async () => {
            readQueryOptions(options);
            const readPath = typeof path === "string" && path.includes("/")
                ? path.split("/").filter(Boolean) : path;
            const value = await getRecord(this.storageKey, readPath);
            return (options.orderBy !== undefined || options.equalTo !== undefined
                || options.start !== undefined || options.end !== undefined || options.order !== undefined)
                ? applyReadOptions(value, options) : value;
        }, options, "read", {path, equalTo: options?.equalTo, orderBy: options?.orderBy,
            order: options?.order, start: options?.start, end: options?.end});
    }

    async readSubtree(path, options = {}) {
        return this.run(() => getSubtree(this.storageKey, path), options, "readSubtree", {path});
    }

    async update(path, changes, options = {}) {
        const batch = typeof path !== "string" && !Array.isArray(path);
        return this.run(() => mutate(this.storageKey,
            batch ? path instanceof Map ? [...path.keys()] : Object.keys(path ?? {}) : [path], async () => {
            if (batch) {
                if (!(path instanceof Map) && !isRecord(path)) invalid("updates must be a Map or record object.");
                const entries = path instanceof Map ? [...path] : Object.entries(path);
                if (entries.some(([, value]) => value instanceof Function)) invalid("Batch updates do not accept callbacks.");
                await updateRecords(this.storageKey, entries);
                return;
            }
            if (changes instanceof Function) return updateRecord(this.storageKey, path, changes);
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
