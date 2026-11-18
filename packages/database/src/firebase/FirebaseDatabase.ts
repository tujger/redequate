import type {FirebaseApp} from "firebase/app";
import {fail} from "../../../common";
import {composeCursor} from "../common/ComposedDatabaseCursor";
import DatabaseBase from "../common/DatabaseBase";
import type {
    DatabasePath, DatabaseValue, DatabaseOptions,
    DatabaseListenerOptions, DatabaseReadOptions, DatabaseCursorOptions
} from "../common/DatabaseTypes";
import addEventListener from "./addEventListener";
import createRecord from "./create";
import FirebaseCursorClient from "./cursor";
import deleteRecord from "./delete";
import parsePath from "./helpers/parsePath";
import read from "./read";
import update from "./update";

type FirebaseDatabaseOptions = DatabaseOptions & {
    backend?: Parameters<DatabaseBase["setBackend"]>[0];
    firebase: {app: FirebaseApp};
};

export default class FirebaseDatabase extends DatabaseBase {
    #firebase: {app: FirebaseApp};

    constructor({backend, firebase, onError}: FirebaseDatabaseOptions) {
        super({backend, onError});
        this.#firebase = firebase;
    }

    addEventListener(path: DatabasePath, options: DatabaseListenerOptions = {}) {
        return super.addEventListener(path, options,
            callbacks => addEventListener(this.#firebase, path, callbacks as Parameters<typeof addEventListener>[2]));
    }

    async create(path: DatabasePath, value: Parameters<DatabaseBase["create"]>[1]): Promise<string | undefined> {
        return createRecord(this.#firebase, path, value, this.run.bind(this), this._backend);
    }

    cursor(path: Parameters<DatabaseBase["cursor"]>[0], options: DatabaseCursorOptions = {}) {
        const run = this.run.bind(this);
        const pathIsDatabasePath = typeof path === "string" ||
            (path instanceof Array && (path.length === 0 || typeof path[0] === "string"));
        const queries = path instanceof Array && !pathIsDatabasePath
            ? path
            : [{path}];
        // Leave invalid options intact for the composition's constructor to validate.
        const effective = options === null || typeof options !== "object" || options instanceof Array
            ? options
            : {...options, onError: options.onError ?? this.onError};
        return composeCursor(queries as Parameters<typeof composeCursor>[0], effective,
            (path, options) => new FirebaseCursorClient(path,
                {...options, onError: options?.onError ?? this.onError},
                {backend: this._backend, database: this, firebase: this.#firebase}), run, path,
            pathIsDatabasePath ? () => parsePath(path as DatabasePath, "collection").address : undefined);
    }

    async delete(path: DatabasePath, options: DatabaseOptions = {}): Promise<void> {
        return deleteRecord(path, options, this.run.bind(this), super.delete.bind(this));
    }

    read(path: DatabasePath, options: DatabaseReadOptions & {shallow: true}): Promise<string[] | undefined>;
    read(path: DatabasePath, options?: DatabaseReadOptions): Promise<DatabaseValue | undefined>;
    async read(path: DatabasePath, options: DatabaseReadOptions = {}): Promise<DatabaseValue | undefined> {
        if (path === "" || (Array.isArray(path) && !path.length)) {
            fail("database/invalid-argument", "read requires a non-empty path.");
        }
        return this.run(() => read(this.#firebase, path, options), options, "read",
            {path, equalTo: options?.equalTo, orderBy: options?.orderBy});
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
