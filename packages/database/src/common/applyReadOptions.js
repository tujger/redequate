import {fail} from "../../../common";
import resolvePath from "./resolvePath";
import compareKeys from "./compareKeys";

const invalid = message => fail("database/invalid-argument", message);
const rank = value => value === null ? 0 : typeof value === "boolean" ? 1
    : typeof value === "number" ? 2 : typeof value === "string" ? 3 : 4;
const compare = (left, right) => rank(left) - rank(right) || (left < right ? -1 : left > right ? 1 : 0);

export function readQueryOptions(options = {}) {
    const {orderBy, order = "asc", equalTo, start, end} = options;
    if (order !== "asc" && order !== "desc") invalid("order must be asc or desc.");
    if (equalTo !== undefined && (start !== undefined || end !== undefined)) {
        invalid("equalTo cannot be combined with start or end.");
    }
    for (const value of [equalTo, start, end]) {
        if (value !== undefined && value !== null && typeof value !== "boolean" && typeof value !== "string"
            && !(typeof value === "number" && Number.isFinite(value))) {
            invalid("Query bounds must be null, booleans, finite numbers or strings.");
        }
    }
    const field = orderBy === undefined ? undefined : resolvePath(orderBy);
    if (field === undefined && (start !== undefined && typeof start !== "string"
        || end !== undefined && typeof end !== "string")) {
        invalid("Key range bounds must be strings.");
    }
    return {field, order, equalTo, start, end};
}

export function applyReadOptions(value, options = {}) {
    const {field, order, equalTo, start, end} = readQueryOptions(options);
    if (value === undefined || value === null || typeof value !== "object") return value;
    const orderedValue = (key, item) => field === undefined ? equalTo !== undefined ? item : key
        : field === "" ? item : field.split("/").reduce((node, name) => node?.[name], item) ?? null;
    const entries = Object.entries(value).map(([key, item]) => ({key, item, sort: orderedValue(key, item)}))
        .filter(({sort}) => (equalTo === undefined || Object.is(sort, equalTo))
            && (start === undefined || (field === undefined ? compareKeys(sort, start) : compare(sort, start)) >= 0)
            && (end === undefined || (field === undefined ? compareKeys(sort, end) : compare(sort, end)) <= 0));
    entries.sort((a, b) => (field === undefined && equalTo === undefined
        ? compareKeys(a.key, b.key) : compare(a.sort, b.sort) || compareKeys(a.key, b.key))
        * (order === "desc" ? -1 : 1));
    return entries.length ? Object.fromEntries(entries.map(({key, item}) => [key, item])) : undefined;
}
