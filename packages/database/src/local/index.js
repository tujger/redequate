import {fail} from "../../../common";
import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import DatabaseBase from "../common/DatabaseBase";
import {composeCursor} from "../common/ComposedDatabaseCursor";
import resolvePath from "../common/resolvePath";
import applyReadOptions, {readQueryOptions} from "../common/applyReadOptions";
import addEventListener from "./addEventListener";
import LocalCursor from "./cursor";
import createRecord from "./create";
import update from "./update";
import deleteRecord from "./delete";
import {readValue, getSubtree, increment, TIMESTAMP, openDatabase} from "./helpers";
import {applySchema} from "./schema";
import {convertStores} from "./storeSchema";

const invalid = message => fail("database/invalid-argument", message);

export default class LocalDatabase extends DatabaseBase {
    #context;
    /**
     * @param {object} [options]
     * @param {{request: Function}} options.backend
     * @param {string} [options.storageId]
     * @param {Array<{store: string, storeConfig: {keyPath: "_id", autoIncrement: true},
     * storeSchema: Array<{name: string, keypath: string | string[],
     * options?: {unique?: boolean, multiEntry?: boolean}}>}>} [options.stores]
     */
    constructor(options = {}) {
        super(options);
        const {storageId = LOCAL_DATABASE_NAME} = options;
        if (typeof storageId !== "string" || !storageId.trim()) {
            fail("database/invalid-argument", "storageId must be a non-empty string.");
        }
        this.storageId = storageId;
        this.#context = {storageId, schema: convertStores(options.stores)};
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
        return applySchema(this.storageId, schema, this.#context.schema);
    }

    addEventListener(path, options = {}) {
        return super.addEventListener(path, options,
            callbacks => addEventListener(this.#context, path, callbacks));
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
                {...sourceOptions, onError: sourceOptions?.onError ?? this.onError}, this._backend),
            this.run.bind(this), path, pathIsDatabasePath ? () => resolvePath(Array.isArray(path) &&
                path.length > 1 && typeof path.at(-1) === "string" ? path.slice(0, -1) : path) : undefined);
    }

    async create(path, value) {
        return createRecord(path, value, this.run.bind(this), super.create.bind(this));
    }

    async delete(path, options = {}) {
        return deleteRecord(path, options, this.run.bind(this), super.delete.bind(this));
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
        return update(path, changes, options, this.run.bind(this), super.update.bind(this));
    }

    get TIMESTAMP() {
        return TIMESTAMP;
    }

    increment(delta) {
        return increment(delta);
    }
}
