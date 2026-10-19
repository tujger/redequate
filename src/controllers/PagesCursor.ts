import {DatabaseCursor} from "../../packages/database/src/common/DatabaseCursor";
import {DatabaseOrder} from "../../packages/database/src/common/DatabaseOrder";
import type {DatabaseCursorOptions} from "../../packages/database/src/common/DatabaseBase";
import normalizePath from "../../packages/database/src/common/normalizePath";
import {fail} from "../../packages/common";
import {matchRole, normalizeSortName} from "./UserData";
import {getCurrentUserData} from "./useCurrentUserData";
import {usePages} from "./General";

type Page = {
    _route: string;
    route: string;
    label?: string;
    title?: string;
    roles?: string[];
    [field: string]: unknown;
};
const pageKey = (page: Page) => page._route + page.label + page.title;

// Match database value ordering; missing fields sort with null, objects last.
function compare(a: unknown, b: unknown): number {
    const rank = (value: unknown) => value == null ? 0 : value === false ? 1 : value === true ? 2
        : typeof value === "number" ? 3 : typeof value === "string" ? 4 : 5;
    const difference = rank(a) - rank(b);
    if (difference) return difference;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
    return 0;
}

export default class PagesCursor extends DatabaseCursor {
    readonly #pages: Page[];

    constructor(options: DatabaseCursorOptions = {}) {
        super(options, "pages");
        if (this.handle !== undefined || this.startDate !== undefined || this.endDate !== undefined) {
            fail("database/invalid-argument", "PagesCursor does not support handle or date bounds.");
        }
        const fields = this.orderBy === undefined ? undefined : normalizePath(this.orderBy).split("/");
        const end = this.end === undefined && typeof this.start === "string" ? this.start + "\uf8ff" : this.end;
        const value = (page: Page) => fields
            ? fields.reduce<unknown>((value, field) => value !== null && typeof value === "object"
                ? (value as Record<string, unknown>)[field] : undefined, page)
            : this.equalTo === undefined ? pageKey(page) : page;
        this.#pages = (Object.values(usePages() ?? {}) as Page[])
            .filter(page => page._route && !page._route.includes(":"))
            .map(page => ({...page, _sort_name: normalizeSortName(page.label || page.title || "")}))
            .filter(page => this.equalTo !== undefined ? compare(value(page), this.equalTo) === 0
                : (this.start === undefined || compare(value(page), this.start) >= 0)
                    && (end === undefined || compare(value(page), end) <= 0))
            .sort((a, b) => (compare(value(a), value(b)) || compare(pageKey(a), pageKey(b)))
                * (this.order === DatabaseOrder.ASC ? 1 : -1));
    }

    async next(n = 1) {
        const result = await super.next(n) ?? [];
        const user = getCurrentUserData();
        const initial = result.length;
        while (result.length - initial < n && this.#pages.length) {
            const page = this.#pages.shift()!;
            if (!matchRole(page.roles, user)) continue;
            result.push({key: pageKey(page),
                value: {route: page.route, name: page.label || page.title || ""}});
        }
        const count = result.length;
        this._count += count;
        this._position = Object.freeze({
            index: this.position.index + count,
            key: result.length ? result[result.length - 1].key : this.position.key,
            finished: !this.#pages.length
        });
        return result;
    }
}
