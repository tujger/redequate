import {vi} from "vitest";

/** In-memory database fixture with root-relative batch updates. */
export const createDatabase = () => {
    const data = {};
    return {
        read: vi.fn(async path => {
            let value = data;
            for (const part of path) value = value?.[part];
            return value === undefined ? undefined : structuredClone(value);
        }),
        update: vi.fn(async updates => {
            for (const [path, value] of updates) {
                let target = data;
                for (const part of path.slice(0, -1)) target = target[part] ??= {};
                if (value === null) delete target[path.at(-1)];
                else target[path.at(-1)] = structuredClone(value);
            }
        }),
    };
};
