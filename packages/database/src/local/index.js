import {fail} from "../../../common";
import DatabaseBase from "../common/DatabaseBase";
import {composeCursor} from "../common/ComposedDatabaseCursor";
import resolvePath from "../common/resolvePath";
import applyReadOptions, {readQueryOptions} from "../common/applyReadOptions";
import parseCreatePath from "../common/parseCreatePath";
import addEventListener, {mutate} from "./addEventListener";
import LocalCursor from "./cursor";
import {addGeneratedRecord, addRecord, deleteRecord, readValue, getSubtree, increment, parseDatabasePath, TIMESTAMP, updateRecord, updateRecords, createRecordPath, openDatabase} from "./helpers";
import {applySchema} from "./schema";
import {convertStores} from "./storeSchema";

const invalid = message => fail("database/invalid-argument", message);
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

export default class LocalDatabase extends DatabaseBase {
    #context;
    /**
     * @param {object} [options]
     * @param {string} [options.storageKey]
     * @param {Array<{store: string, storeConfig: {keyPath: "_id", autoIncrement: true},
     * storeSchema: Array<{name: string, keypath: string | string[],
     * options?: {unique?: boolean, multiEntry?: boolean}}>}>} [options.stores]
     */
    constructor(options = {}) {
        super(options);
        const {storageKey = "redequate:database:local"} = options;
        if (typeof storageKey !== "string" || !storageKey.trim()) {
            fail("database/invalid-argument", "storageKey must be a non-empty string.");
        }
        this.storageKey = storageKey;
        this.#context = {storageKey, schema: convertStores(options.stores)};
    }

    /**
     * Apply an IndexedDB schema; this API belongs to the Local provider only.
     * @param {Record<string, {keyPath: string | string[], autoIncrement: boolean,
     * indexes: Record<string, {keyPath: string | string[], unique?: boolean, multiEntry?: boolean}>}>} schema
     * @returns {Promise<void>}
     */
    async applySchema(schema) {
        const connection = await openDatabase(this.#context);
        connection.close();
        return applySchema(this.storageKey, schema, this.#context.schema);
    }

    addEventListener(path, options = {}) {
        const report = (error, reason, context) => {
            try {
                (options.onError ?? this.onError)(error, reason, context);
            } catch (handlerError) {
                console.error("LocalDatabase listener error", handlerError === error
                    ? {path, reason, error}
                    : {path, reason, error, handlerError});
                return;
            }
            console.error("LocalDatabase listener error", {path, reason, error});
        };
        return super.addEventListener(path, {...options, onError: report},
            callbacks => addEventListener(this.#context, path, callbacks)) ?? {remove() {}};
    }

    cursor(path, options = {}) {
        const pathIsDatabasePath = typeof path === "string" || (path instanceof Array &&
            (path.length === 0 || typeof path[0] === "string"));
        const queries = path instanceof Array && !pathIsDatabasePath ? path : [{path}];
        const effective = options === null || typeof options !== "object" || options instanceof Array
            ? options
            : {...options, onError: options.onError ?? this.onError};
        return composeCursor(queries, effective,
            (sourcePath, sourceOptions) => new LocalCursor(this.#context, sourcePath,
                {...sourceOptions, onError: sourceOptions?.onError ?? this.onError}),
            this.run.bind(this), path, pathIsDatabasePath ? () => resolvePath(Array.isArray(path) &&
                path.length > 1 && typeof path.at(-1) === "string" ? path.slice(0, -1) : path) : undefined);
    }

    async create(path, value) {
        return this.run(() => {
            const {key: suppliedKey} = parseCreatePath(path);
            const resolveValue = key => {
                const result = value instanceof Function ? value(key) : value;
                if (result?.then instanceof Function) {
                    Promise.resolve(result).catch(() => {});
                    invalid("create callback must be synchronous.");
                }
                if (!isRecord(result)) invalid("value must be a record object.");
                return result;
            };
            if (suppliedKey !== undefined) {
                const recordPath = createRecordPath(path, suppliedKey);
                return mutate(this.#context, [recordPath], async () => {
                    await addRecord(this.#context, recordPath, () => resolveValue(suppliedKey));
                    return suppliedKey;
                });
            }
            return mutate(this.#context, [path], () =>
                addGeneratedRecord(this.#context, path, resolveValue));
        }, undefined, "create", {path, value});
    }

    async delete(path, options = {}) {
        return this.run(() => mutate(this.#context, [path], () => parseDatabasePath(path).kind === "collection"
            ? updateRecords(this.#context, [[path, null]])
            : deleteRecord(this.#context, path)), options, "delete", {path});
    }

    async read(path, options = {}) {
        if (path === "" || (Array.isArray(path) && !path.length)) {
            invalid("read requires a non-empty path.");
        }
        return this.run(async () => {
            readQueryOptions(options);
            const value = await readValue(this.#context, path, options);
            return (options.orderBy !== undefined || options.equalTo !== undefined ||
                options.start !== undefined || options.end !== undefined || options.order !== undefined)
                ? applyReadOptions(value, options)
                : value;
        }, options, "read", {
            path,
            equalTo: options?.equalTo,
            orderBy: options?.orderBy,
            order: options?.order,
            start: options?.start,
            end: options?.end
        });
    }

    async readSubtree(path, options = {}) {
        return this.run(() => getSubtree(this.#context, path), options, "readSubtree", {path});
    }

    async update(path, changes, options = {}) {
        const batch = typeof path !== "string" && !Array.isArray(path);
        return this.run(() => mutate(this.#context,
            batch ? path instanceof Map ? [...path.keys()] : Object.keys(path ?? {}) : [path], async () => {
                if (batch) {
                    if (!(path instanceof Map) && !isRecord(path)) invalid("updates must be a Map or record object.");
                    const entries = path instanceof Map ? [...path] : Object.entries(path);
                    if (entries.some(([, value]) => value instanceof Function)) invalid("Batch updates do not accept callbacks.");
                    await updateRecords(this.#context, entries);
                    return;
                }
                if (changes instanceof Function) return updateRecord(this.#context, path, changes);
                const parsed = parseDatabasePath(path);
                if (parsed.field) invalid("update requires a record path.");
                if (!isRecord(changes)) invalid("changes must be a record object.");
                await updateRecords(this.#context, [[path, changes]], {merge: true});
            }), batch ? changes ?? options : options, "update", batch ? {updates: path} : {path, changes});
    }

    get TIMESTAMP() {
        return TIMESTAMP;
    }

    increment(delta) {
        return increment(delta);
    }
}
