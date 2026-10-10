import React from "react";
import {vi} from "vitest";
import Base from "../StorageBase";
import Provider, {useStorage} from "../useStorage";
import LocalTest from "../local-test";
import {resolveStorage} from "../resolveStorage";
import {render, unmount} from "../../../../src/__tests__/render";

it("exposes abstract operations with rejected promises", async () => {
    for (const method of ["upload", "resolveDownloadURL", "resolveMetadata", "delete"]) {
        await expect(new Base()[method]({})).rejects.toThrow(`Not implemented: ${method}`);
    }
});
it("resolves local defaults and preserves explicit providers", async () => {
    expect(await resolveStorage()).toBeInstanceOf(LocalTest);
    const provider = new LocalTest();
    expect(await resolveStorage(provider)).toBe(provider);
    for (const value of [null, [], 1, "invalid"]) await expect(resolveStorage(value)).rejects.toThrow("Dispatcher storage");
    delete window.redequateMessaging;
});
it("uses the nearest provider and rejects a missing provider", () => {
    const observed = [];
    const outer = {};
    const inner = {};
    const container = document.createElement("div");
    const Probe = () => { observed.push(useStorage()); return null; };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
        render(React.createElement(Provider, {value: outer}, React.createElement(Probe),
            React.createElement(Provider, {value: inner}, React.createElement(Probe)), React.createElement(Probe)), container);
        expect(observed).toEqual([outer, inner, outer]);
        unmount(container);
        expect(() => render(React.createElement(Probe), container)).toThrow("useStorage requires a Dispatcher Storage provider");
    } finally { unmount(container); error.mockRestore(); }
});
