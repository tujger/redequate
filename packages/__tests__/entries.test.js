import {vi} from "vitest";

it.each(["auth", "messaging", "storage"])("keeps %s entrypoints consistent and helpers private", async area => {
    const get = vi.spyOn(Storage.prototype, "getItem");
    const set = vi.spyOn(Storage.prototype, "setItem");
    const root = await import(`../${area}/index.js`);
    const source = await import(`../${area}/src/index.js`);
    const name = area[0].toUpperCase() + area.slice(1);
    expect(Object.keys(root).sort()).toEqual([`${name}Base`]);
    expect(Object.keys(source).sort()).toEqual([`${name}Base`, `resolve${name}`].sort());
    expect(root[`${name}Base`]).toBe(source[`${name}Base`]);
    expect(source).not.toHaveProperty(`use${name}`);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
});
