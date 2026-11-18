import {getDatabase, ref, query, orderByChild, orderByValue, orderByKey, equalTo, startAt, endAt, limitToFirst, limitToLast, onChildAdded, onChildChanged, onChildRemoved} from "firebase/database";
import type {DataSnapshot, Query, QueryConstraint, Unsubscribe} from "firebase/database";
import type {FirebaseApp} from "firebase/app";
import FirebaseCursorBase, {type QueryMethod} from "../common/FirebaseCursorBase";
import type {
    CursorStatus, DatabaseCursorEvent, DatabaseCursorOptions, DatabaseCursorPosition,
    DatabaseCursorSubscription, DatabaseEntry, DatabasePath, DatabaseValue
} from "../common/DatabaseTypes";
import parsePath from "./helpers/parsePath";
import readSnapshot from "./helpers/readSnapshot";

const constraints = {orderByChild, orderByValue, orderByKey, equalTo, startAt, endAt, limitToFirst, limitToLast};

type ClientContext = NonNullable<ConstructorParameters<typeof FirebaseCursorBase>[2]> & {
    firebase?: {app: FirebaseApp};
};
type SubscriptionQuery = {initialQuery: Query; startKey?: string; endKey?: string; orderBy?: string};

export default class FirebaseCursorClient extends FirebaseCursorBase {
    #firebase?: ClientContext["firebase"];
    #status: CursorStatus = {
        checkpoint: null,
        count: 0,
        finishedAt: null,
        startedAt: null,
        state: "ready",
        updatedAt: null,
        userId: null,
    };
    #updates = new Map<DatabasePath, DatabaseValue>();

    constructor(path: DatabasePath, options: DatabaseCursorOptions & {id?: string} = {},
        {backend, database, firebase}: ClientContext = {}) {
        super(path, options, {backend, database});
        this.#firebase = firebase;
    }

    override subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription {
        super.subscribe(listener);
        const state = this._queryState();
        const subscription = subscribeEntries({...state, initialQuery: state.initialQuery as Query}, event => {
            this._started = true;
            this._count += {add: 1, change: 0, remove: -1}[event.type];
            return listener(event);
        }, error => this.onError!(error, "cursor.subscribe", {path: this.path}));
        // The composite cursor provides the public subscription metadata.
        return subscription as DatabaseCursorSubscription;
    }

    override async all(size?: number, checkpoint?: DatabaseCursorPosition | null): Promise<number> {
        const saveStatus = async (status: CursorStatus) => {
            this.#status = status;
        };
        return super._all(size, checkpoint, {
            saveStatus,
            recordPath: (branch, key) => {
                const {address} = parsePath(branch, "collection");
                return address ? `${address}/${key}` : key;
            },
            commitPage: async (status, changes) => {
                for (const [path, value] of changes) this.#updates.set(path, value);
                await saveStatus(status);
            }
        });
    }

    override async status(): Promise<CursorStatus> {
        const {checkpoint, error, ...status} = this.#status;
        return {
            ...status,
            checkpoint: checkpoint ? {...checkpoint} : null,
            ...(error ? {error: {...error}} : {}),
            updates: new Map(this.#updates),
        };
    }

    protected override _reference(address: string): ReturnType<typeof ref> {
        return ref(getDatabase(this.#firebase!.app), address);
    }

    protected override _query(reference: Query, method: QueryMethod, ...args: DatabaseValue[]): Query {
        const constrain = constraints[method] as (...values: DatabaseValue[]) => QueryConstraint;
        return query(reference, constrain(...args));
    }

    protected override _readSnapshot(reference: Query): Promise<DataSnapshot> {
        return readSnapshot(reference) as Promise<DataSnapshot>;
    }
}

function subscribeEntries(
    state: SubscriptionQuery,
    notify: (event: DatabaseCursorEvent) => void,
    onError: (error: unknown) => void
): Pick<DatabaseCursorSubscription, "unsubscribe"> {
    const {initialQuery, startKey, endKey, orderBy} = state;
    const orderedEntries = new Map<string, DatabaseEntry>();
    let active = true; let initialized = false; let failed = false; let registering = true;
    const report = (error: unknown) => {
        if (active && !failed) {
            failed = true;
            // Registration errors go through the composition's existing boundary.
            if (registering) throw error;
            onError(error);
        }
    };
    const events = [["child_added", "add"], ["child_changed", "change"], ["child_removed", "remove"]] as const;
    const callbacks = events.map(([event, type]) => [event, (child: DataSnapshot) => {
        if (!active) return;
        if (startKey !== undefined && child.key < startKey) return;
        if (endKey !== undefined && child.key > endKey) return;
        let entry: DatabaseEntry = {key: child.key, value: child.val()};
        let effectiveType: DatabaseCursorEvent["type"] = type;
        if (orderBy) {
            const previous = orderedEntries.get(child.key);
            const included = type !== "remove" && hasOrderedField(child, orderBy);
            if (included) orderedEntries.set(child.key, entry);
            else orderedEntries.delete(child.key);
            if (!included && !previous) return;
            if (!included) {
                effectiveType = "remove";
                entry = previous!;
            } else {
                effectiveType = previous ? "change" : "add";
            }
        }
        if (initialized) return notify({type: effectiveType, entry});
    }] as const);
    const unsubscribers: Unsubscribe[] = [];
    const unsubscribe = () => {
        if (!active) return;
        active = false;
        detachCallbacks(unsubscribers);
    };
    try {
        for (const [event, callback] of callbacks) {
            const subscribe = {child_added: onChildAdded, child_changed: onChildChanged, child_removed: onChildRemoved}[event];
            unsubscribers.push(subscribe(initialQuery, callback, report));
        }
        readSnapshot(initialQuery).then(() => { initialized = true; }, report);
        registering = false;
    } catch (error) {
        unsubscribe();
        throw error;
    }
    return {unsubscribe};
}

const detachCallbacks = (unsubscribers: Unsubscribe[]) => {
    let failure: {error: unknown} | undefined;
    for (const unsubscribe of unsubscribers) {
        try { unsubscribe(); } catch (error) { failure ??= {error}; }
    }
    if (failure) throw failure.error;
};

const hasOrderedField = (snapshot: DataSnapshot, orderBy?: string) => !orderBy || snapshot.child(orderBy).exists();
