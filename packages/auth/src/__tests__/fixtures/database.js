import {vi} from "vitest";

/** In-memory database fixture with root-relative batch updates. */
export const createDatabase = () => {
    const data = {};
    const parts = path => (typeof path === "string" ? [path] : path)
        .flatMap(segment => (typeof segment === "string" ? segment : Object.values(segment)[0]).split("/"))
        .filter(Boolean);
    return {
        cursor: vi.fn(path => ({
            next: vi.fn(async n => Object.entries(data[parts(path)[0]] || {}).slice(0, n)
                .map(([key, value]) => ({key, value: structuredClone(value)})))
        })),
        read: vi.fn(async (path, options = {}) => {
            let value = data;
            for (const part of parts(path)) value = value?.[part];
            if (options.equalTo !== undefined && value != null) {
                value = Object.fromEntries(Object.entries(value).filter(([, child]) => child === options.equalTo));
            }
            return value === undefined ? undefined : structuredClone(value);
        }),
        update: vi.fn(async updates => {
            for (const [source, value] of updates) {
                const path = parts(source);
                let target = data;
                for (const part of path.slice(0, -1)) target = target[part] ??= {};
                if (value === null) delete target[path.at(-1)];
                else target[path.at(-1)] = structuredClone(value);
            }
        }),
    };
};
