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
import parsePath from "./parsePath";
import read from "./read";
import {baseRules, resolveRules} from "./rules.mjs";
import update from "./update";

type FirebaseDatabaseOptions = DatabaseOptions & {
    backend?: Parameters<DatabaseBase["setBackend"]>[0];
    firebase: {app: FirebaseApp};
    rules?: {additions?: Record<string, unknown>; overrides?: Record<string, unknown>};
};

export default class FirebaseDatabase extends DatabaseBase {
    #firebase: {app: FirebaseApp};
    rules: ReturnType<typeof resolveRules>;

    constructor({backend, firebase, onError, rules = {}}: FirebaseDatabaseOptions) {
        super({backend, onError});
        this.#firebase = firebase;
        this.rules = resolveRules(baseRules, rules);
    }

    addEventListener(path: DatabasePath, options: DatabaseListenerOptions = {}) {
        return super.addEventListener(path, options,
            callbacks => addEventListener(this.#firebase, path, callbacks as Parameters<typeof addEventListener>[2]));
    }

    async create(path: DatabasePath, value: Parameters<DatabaseBase["create"]>[1]): Promise<string | undefined> {
        return createRecord(this.#firebase, path, value, this.run.bind(this), super.create.bind(this));
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
        // The JS source adapter returns an unsubscribe handle; composition owns the public subscription.
        return composeCursor(queries as Parameters<typeof composeCursor>[0], effective,
            (path, options) => new FirebaseCursorClient(this.#firebase, path,
                {...options, onError: options?.onError ?? this.onError}, this._backend) as unknown as ReturnType<DatabaseBase["cursor"]>, run, path,
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
