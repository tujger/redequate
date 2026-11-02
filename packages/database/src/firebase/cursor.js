import {getDatabase, ref, query, orderByChild, orderByValue, orderByKey, equalTo, startAt, endAt, limitToFirst, limitToLast, onChildAdded, onChildChanged, onChildRemoved} from "firebase/database";
import FirebaseCursorBase from "../common/FirebaseCursorBase";
import readSnapshot from "./readSnapshot";

const constraints = {orderByChild, orderByValue, orderByKey, equalTo, startAt, endAt, limitToFirst, limitToLast};

export default class FirebaseCursorClient extends FirebaseCursorBase {
    #firebase;

    constructor(firebase, path, options = {}, backend) {
        super(path, options, backend);
        this.#firebase = firebase;
    }

    _reference(address) { return ref(getDatabase(this.#firebase.app), address); }
    _query(reference, method, ...args) { return query(reference, constraints[method](...args)); }
    _readSnapshot(reference) { return readSnapshot(reference); }

    subscribe(listener) {
        super.subscribe(listener);
        return subscribeEntries(this._queryState(), event => {
            this._started = true;
            this._count += event.type === "add" ? 1 : event.type === "remove" ? -1 : 0;
            return listener(event);
        }, error => this.onError(error, "cursor.subscribe", {path: this.path}));
    }
}

function subscribeEntries(state, notify, onError) {
    const {initialQuery, startKey, endKey, orderBy} = state;
    const orderedEntries = new Map();
    let active = true; let initialized = false; let failed = false; let registering = true;
    const report = error => {
        if (active && !failed) {
            failed = true;
            // Registration errors go through the composition's existing boundary.
            if (registering) throw error;
            onError(error);
        }
    };
    const callbacks = [["child_added", "add"], ["child_changed", "change"], ["child_removed", "remove"]]
        .map(([event, type]) => [event, child => {
            if (!active || (startKey !== undefined && child.key < startKey) ||
                (endKey !== undefined && child.key > endKey)) return;
            let entry = {key: child.key, value: child.val()};
            let effectiveType = type;
            if (orderBy) {
                const previous = orderedEntries.get(child.key);
                const included = type !== "remove" && hasOrderedField(child, orderBy);
                if (included) orderedEntries.set(child.key, entry);
                else orderedEntries.delete(child.key);
                if (!included && !previous) return;
                if (!included) {
                    effectiveType = "remove";
                    entry = previous;
                } else {
                    effectiveType = previous ? "change" : "add";
                }
            }
            if (initialized) return notify({type: effectiveType, entry});
        }]);
    const unsubscribers = [];
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

const detachCallbacks = unsubscribers => {
    let failure;
    for (const unsubscribe of unsubscribers) {
        try { unsubscribe(); } catch (error) { failure ??= {error}; }
    }
    if (failure) throw failure.error;
};


const hasOrderedField = (snapshot, orderBy) => !orderBy || snapshot.child(orderBy).exists();
