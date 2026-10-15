import {key} from "firebase-key";
import {fail} from "../../../common/src/_packages";
import {resolvePath} from "./common";

export default function createCursorQuery(firebase, path, {orderBy, equalTo, start, end, startDate, endDate, order = "asc"}) {
    orderBy = resolvePath(orderBy);
    if (orderBy !== undefined && (typeof orderBy !== "string" || !orderBy)) {
        fail("database/invalid-argument", "orderBy must be a non-empty field path.");
    }
    if (order !== "asc" && order !== "desc") {
        fail("database/invalid-argument", "order must be asc or desc.");
    }
    if (equalTo !== undefined && (start !== undefined || end !== undefined)) {
        fail("database/invalid-argument", "equalTo cannot be combined with start or end.");
    }
    const startKey = startDate === undefined ? undefined : key(startDate, "min");
    const endKey = endDate === undefined ? undefined : key(endDate, "max");
    if (typeof start === "string" && end === undefined) {
        end = start + "\uf8ff";
    }
    if (orderBy === undefined && equalTo === undefined) {
        // Explicit key bounds remain in the query; date bounds also filter the scan.
        if (start === undefined) {
            start = startKey;
        }
        if (end === undefined) {
            end = endKey;
        }
    }
    const ref = firebase.database().ref(resolvePath(path));
    const baseQuery = orderBy === undefined ? ref.orderByKey() : ref.orderByChild(orderBy);
    const ascending = order === "asc";
    let initialQuery = baseQuery;
    let continuationQuery = baseQuery;
    if (equalTo !== undefined) {
        initialQuery = baseQuery.equalTo(equalTo);
        continuationQuery = ascending ? baseQuery.endAt(equalTo) : baseQuery.startAt(equalTo);
    } else {
        if (start !== undefined) {
            initialQuery = initialQuery.startAt(start);
        }
        if (end !== undefined) {
            initialQuery = initialQuery.endAt(end);
        }
        if (ascending && end !== undefined) {
            continuationQuery = continuationQuery.endAt(end);
        }
        if (!ascending && start !== undefined) {
            continuationQuery = continuationQuery.startAt(start);
        }
    }
    return {initialQuery, continuationQuery, ascending, orderBy, startKey, endKey};
}
