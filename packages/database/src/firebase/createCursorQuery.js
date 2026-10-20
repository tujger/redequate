import {key} from "firebase-key";
import {DatabaseOrder} from "../common/DatabaseOrder";
import resolvePath from "./resolvePath";

export default function createCursorQuery(firebase, path, {
    orderBy,
    equalTo,
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
    const byValue = orderBy === "" || orderBy === undefined && equalTo !== undefined;
    let baseQuery;
    if (orderBy !== undefined && orderBy !== "") {
        baseQuery = ref.orderByChild(orderBy);
    } else if (byValue) {
        baseQuery = ref.orderByValue();
    } else {
        baseQuery = ref.orderByKey();
    }
    const ascending = order === DatabaseOrder.ASC;
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
    return {initialQuery, continuationQuery, ascending, orderBy, byValue, startKey, endKey};
}
