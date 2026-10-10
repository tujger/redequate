// @vitest-environment node
import {fileURLToPath} from "node:url";
import {packageSourcePattern} from "../_build.mjs";
import {withAuth} from "../auth/build.mjs";
import {withMessaging} from "../messaging/build.mjs";
import {withStorage} from "../storage/build.mjs";

it.each([["auth", withAuth], ["messaging", withMessaging], ["storage", withStorage]])("preserves %s entries and output fallbacks", (area, extend) => {
    const source = fileURLToPath(new URL(`../${area}/src/`, import.meta.url));
    expect(packageSourcePattern(source)).toBe(`${source}**/*.js`);
    const config = {
        input: {main: "original"},
        output: [
            {format: "es", entryFileNames: chunk => `${chunk.name}.es.js`, chunkFileNames: () => "core.es.js"},
            {format: "cjs", entryFileNames: "[name].js", chunkFileNames: "core.js"},
        ]
    };
    const result = extend(config);
    expect(result.input.main).toBe("original");
    for (const entry of ["index", "firebase", "local-test"]) {
        expect(result.input[`${area}/${entry}`]).toContain(`/packages/${area}/src/`);
        expect(result.output[0].entryFileNames({name: `${area}/${entry}`})).toBe("[name].mjs");
        expect(result.output[1].entryFileNames({name: `${area}/${entry}`})).toBe("[name].cjs");
    }
    expect(result.output[0].entryFileNames({name: "main"})).toBe("main.es.js");
    expect(result.output[1].entryFileNames({name: "main"})).toBe("[name].js");
    const local = {moduleIds: [source + "index.js", "\0rollupPluginBabelHelpers.js"]};
    const shared = {moduleIds: [fileURLToPath(new URL("../_common/src/_packages.js", import.meta.url))]};
    const web = {moduleIds: ["/src/Dispatcher.js"]};
    expect(result.output[0].chunkFileNames(local)).toBe("chunks/[name]-[hash].mjs");
    expect(result.output[0].chunkFileNames(shared)).toBe("core.es.js");
    expect(result.output[0].chunkFileNames(web)).toBe("core.es.js");
    expect(result.output[0].chunkFileNames({moduleIds: []})).toBe("core.es.js");
    expect(result.output[1].chunkFileNames(shared)).toBe("core.js");
    expect(config.input).toEqual({main: "original"});
});
it("supplies default entry names", () => {
    const result = withStorage({input: {}, output: [{format: "es"}]});
    expect(result.output[0].entryFileNames({name: "other"})).toBe("[name].js");
});
