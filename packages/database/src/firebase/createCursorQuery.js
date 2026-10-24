import {getDatabase, ref, query, orderByChild, orderByValue, orderByKey, equalTo, startAt, endAt} from "firebase/database";
import {key} from "firebase-key";
import {DatabaseOrder} from "../common/DatabaseOrder";
import resolvePath from "../common/resolvePath";

export default function createCursorQuery(firebase, path, {
    orderBy,
    equalTo: equals,
    start,
    end,
    startDate,
    endDate,
    order = DatabaseOrder.ASC
}) {
    orderBy = orderBy === undefined ? undefined : resolvePath(orderBy);
    const startKey = startDate === undefined ? undefined : key(startDate, "min");
    const endKey = endDate === undefined ? undefined : key(endDate, "max");
    if (typeof start === "string" && end === undefined) {
        end = start + "\uf8ff";
    }
    if (orderBy === undefined && equals === undefined) {
        // Explicit key bounds remain in the query; date bounds also filter the scan.
        if (start === undefined) {
            start = startKey;
        }
        if (end === undefined) {
            end = endKey;
        }
    }
    const reference = ref(getDatabase(firebase.app), resolvePath(path));
    const byValue = orderBy === "" || orderBy === undefined && equals !== undefined;
    let baseQuery;
    if (orderBy !== undefined && orderBy !== "") {
        baseQuery = query(reference, orderByChild(orderBy));
    } else if (byValue) {
        baseQuery = query(reference, orderByValue());
    } else {
        baseQuery = query(reference, orderByKey());
    }
    const ascending = order === DatabaseOrder.ASC;
    let initialQuery = baseQuery;
    let continuationQuery = baseQuery;
    if (equals !== undefined) {
        initialQuery = query(baseQuery, equalTo(equals));
        continuationQuery = ascending ? query(baseQuery, endAt(equals)) : query(baseQuery, startAt(equals));
    } else {
        if (start !== undefined) {
            initialQuery = query(initialQuery, startAt(start));
        }
        if (end !== undefined) {
            initialQuery = query(initialQuery, endAt(end));
        }
        if (ascending && end !== undefined) {
            continuationQuery = query(continuationQuery, endAt(end));
        }
        if (!ascending && start !== undefined) {
            continuationQuery = query(continuationQuery, startAt(start));
        }
    }
    return {initialQuery, continuationQuery, ascending, orderBy, byValue, startKey, endKey};
}
