import {validateShallowRead} from "../common/shallowRead";
import {fail} from "../../../common";
import {LOCAL_DATABASE_NAME} from "../../../common/src/localDatabase";
import DatabaseBase from "../common/DatabaseBase";
import type {
    DatabasePath, DatabaseValue, DatabaseOptions,
    DatabaseListenerOptions, DatabaseReadOptions, DatabaseCursorOptions
} from "../common/DatabaseTypes";
import {composeCursor} from "../common/ComposedDatabaseCursor";
import parsePath from "./parsePath";
import applyReadOptions, {readQueryOptions} from "../common/applyReadOptions";
import addEventListener from "./addEventListener";
import LocalCursor from "./cursor";
import createRecord from "./create";
import update from "./update";
import deleteRecord from "./delete";
import {readValue, getSubtree, openDatabase} from "./helpers";
import {applySchema} from "./schema";
import {convertStores} from "./storeSchema";

type LocalStore = {
    store: string;
    storeConfig: {keyPath: "_id"; autoIncrement: true};
    storeSchema: {
        name: string;
        keypath: string | string[];
        options?: {unique?: boolean; multiEntry?: boolean};
    }[];
};
type LocalSchema = Record<string, {
    keyPath: string | string[];
    autoIncrement: boolean;
    indexes: Record<string, {keyPath: string | string[]; unique?: boolean; multiEntry?: boolean}>;
}>;
type LocalDatabaseOptions = DatabaseOptions & {
    backend?: Parameters<DatabaseBase["setBackend"]>[0];
    storageId?: string;
    stores?: LocalStore[];
};

const invalid = (message: string) => fail("database/invalid-argument", message);

export default class LocalDatabase extends DatabaseBase {
    storageId: string;
    #context: {storageId: string; schema: LocalSchema; ready?: Promise<void>};

    constructor(options: LocalDatabaseOptions = {}) {
        super(options);
        const {storageId = LOCAL_DATABASE_NAME} = options;
        if (typeof storageId !== "string" || !storageId.trim()) {
            fail("database/invalid-argument", "storageId must be a non-empty string.");
        }
        this.storageId = storageId;
        this.#context = {storageId, schema: convertStores(options.stores)};
    }

    /** Apply an IndexedDB schema; this API belongs to the Local provider only. */
    async applySchema(schema: LocalSchema): Promise<void> {
        const connection = await openDatabase(this.#context);
        connection.close();
        return applySchema(this.storageId, schema, this.#context.schema);
    }

    addEventListener(path: DatabasePath, options: DatabaseListenerOptions = {}) {
        return super.addEventListener(path, options,
            callbacks => addEventListener(this.#context, path, callbacks));
    }

    cursor(path: Parameters<DatabaseBase["cursor"]>[0], options: DatabaseCursorOptions = {}) {
        const pathIsDatabasePath = typeof path === "string" || (path instanceof Array &&
            (path.length === 0 || typeof path[0] === "string"));
        const queries = path instanceof Array && !pathIsDatabasePath ? path : [{path}];
        const effective = options === null || typeof options !== "object" || options instanceof Array
            ? options
            : {...options, onError: options.onError ?? this.onError};
        return composeCursor(queries as Parameters<typeof composeCursor>[0], effective,
            (sourcePath, sourceOptions) => new LocalCursor(this.#context, sourcePath,
                {...sourceOptions, onError: sourceOptions?.onError ?? this.onError}, this._backend),
            this.run.bind(this), path, pathIsDatabasePath ? () => parsePath(path as DatabasePath, "collection").address : undefined);
    }

    async create(path: DatabasePath, value: Parameters<DatabaseBase["create"]>[1]): Promise<string | undefined> {
        return createRecord(path, value, this.run.bind(this), super.create.bind(this));
    }

    async delete(path: DatabasePath, options: DatabaseOptions = {}): Promise<void> {
        return deleteRecord(path, options, this.run.bind(this), super.delete.bind(this));
    }

    read(path: DatabasePath, options: DatabaseReadOptions & {shallow: true}): Promise<string[] | undefined>;
    read(path: DatabasePath, options?: DatabaseReadOptions): Promise<DatabaseValue | undefined>;
    async read(path: DatabasePath, options: DatabaseReadOptions = {}): Promise<DatabaseValue | undefined> {
        if (path === "" || (Array.isArray(path) && !path.length)) {
            invalid("read requires a non-empty path.");
        }
        return this.run(async () => {
            validateShallowRead(options);
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

    async readSubtree(path: DatabasePath, options: DatabaseOptions = {}): Promise<DatabaseValue | undefined> {
        return this.run(() => getSubtree(this.#context, path), options, "readSubtree", {path});
    }

    update(path: DatabasePath, callback: (value: DatabaseValue) => DatabaseValue | void, options?: DatabaseOptions): Promise<DatabaseValue | undefined>;
    update(path: DatabasePath, changes: Record<string, DatabaseValue>, options?: DatabaseOptions): Promise<void>;
    update(updates: Map<DatabasePath, DatabaseValue> | Record<string, DatabaseValue>, options?: DatabaseOptions): Promise<void>;
    async update(path: DatabasePath | Map<DatabasePath, DatabaseValue> | Record<string, DatabaseValue>,
        changes?: Record<string, DatabaseValue> | ((value: DatabaseValue) => DatabaseValue | void) | DatabaseOptions,
        options: DatabaseOptions = {}): Promise<DatabaseValue | void> {
        return update(path, changes, options, this.run.bind(this), super.update.bind(this));
    }
}
