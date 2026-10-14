import {notImplemented} from '../../common/src/_packages'

/**
 * A path relative to the provider root. Array elements are joined with '/'
 * and may themselves contain nested paths. '' and [] identify the root.
 * Providers validate and normalize paths; this base class does neither.
 * @typedef {string | string[]} DatabasePath
 */

/** @typedef {null | boolean | number | string | DatabaseValue[] | DatabaseRecord} DatabaseValue */
/** @typedef {Object<string, DatabaseValue>} DatabaseRecord */
/** @typedef {{key: string, value: DatabaseRecord}} DatabaseEntry */

export default class DatabaseBase {
    addEventListener(path, {
        onChange,
        onChildAdd,
        onChildChange,
        onChildRemove,
        onError,
        orderBy
    }) {
        return notImplemented("addValueListener");
    }

    /**
     * Create a record in a collection without overwriting an existing record.
     * The provider generates a key when none is supplied. Conflicts reject.
     * Resolves after the record has been written to the provider's storage.
     * @param {DatabasePath} path Collection path.
     * @param {DatabaseRecord} value JSON-compatible record data.
     * @param {string} [key] Explicit record key.
     * @returns {Promise<string>} Created record key.
     */
    async create(path, value, key= undefined) {
        return notImplemented('create')
    }

    /**
     * Read a record as plain data, without provider references or snapshots.
     * Access and read failures reject; an absent record resolves to undefined.
     * @param {DatabasePath} path Record path.
     * @returns {Promise<DatabaseRecord | undefined>}
     */
    async read(path, {equalTo = undefined, orderBy = undefined} = {}) {
        return notImplemented('read')
    }

    /**
     * Update an existing record's top-level fields. Nested values are replaced
     * in full; null removes a field. An absent record rejects, without creating it.
     * Resolves after the changes have been written to the provider's storage.
     * @param {DatabasePath} path Record path.
     * @param {DatabaseRecord} changes Partial record data.
     * @returns {Promise<void>}
     */
    async update(path, changes, {} = {}) {
        return notImplemented('update')
    }

    /**
     * Delete a record. Deleting an absent record also succeeds.
     * Resolves after deletion in the provider's storage; write failures reject.
     * @param {DatabasePath} path Record path.
     * @returns {Promise<void>}
     */
    async delete(path, {} = {}) {
        return notImplemented('delete')
    }

    /**
     * Iterate over a collection's immediate records using for await...of.
     * An empty collection yields nothing. Early termination, including break,
     * releases provider resources. No common ordering or consistent snapshot
     * across the traversal is guaranteed. Failures reject the next() operation.
     * @param {DatabasePath} path Collection path.
     * @returns {AsyncIterable<DatabaseEntry>}
     */
    async* iterate(path) {
        yield notImplemented('iterate')
    }

    async write(path, value, {} = {}) {
        return notImplemented('write')
    }

    get TIMESTAMP() {
        return notImplemented('timestamp')
    }

    increment(delta) {
        return notImplemented('increment')
    }
}
