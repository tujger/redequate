import {builtinModules} from "node:module";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import del from "rollup-plugin-delete";

const source = path => fileURLToPath(new URL(path, import.meta.url));
const outputDirectory = source("./dist/");
const manifest = JSON.parse(readFileSync(source("./package.json"), "utf8"));
const dependencies = Object.keys(manifest.dependencies || {});
const backendNames = ["common", "common-server", "firebase-server", "local-test-server"];
const directories = [
    source("../common/src/"),
    ...backendNames
        .map(name => source(`../backend/src/${name}/`)),
];

const entries = {
    "common/index": source("../common/src/index.js"),
    ...Object.fromEntries(backendNames
        .map(name => [`backend/${name}`, source(`../backend/src/${name}/index.js`)])),
};

export default {
    input: entries,
    external: id => id.startsWith("node:") || builtinModules.includes(id) ||
        dependencies.some(name => id === name || id.startsWith(`${name}/`)),
    output: ["es", "cjs"].map(format => ({
        dir: outputDirectory,
        format,
        exports: "named",
        entryFileNames: format === "es" ? "[name].mjs" : "[name].cjs",
        chunkFileNames: format === "es" ? "server-chunks/[name]-[hash].mjs" : "server-chunks/[name]-[hash].cjs",
        sourcemap: true,
    })),
    plugins: [
        del({targets: [outputDirectory]}),
        nodeResolve(),
        {
            name: "server-source-boundary",
            generateBundle() {
                for (const id of this.getModuleIds()) {
                    if (!this.getModuleInfo(id).isExternal && !directories.some(directory => id.startsWith(directory))) {
                        this.error(`Server package cannot include modules outside its source boundary: ${id}`);
                    }
                }
            },
        },
    ],
    onwarn(warning, warn) {
        if (warning.code === "UNRESOLVED_IMPORT") throw new Error(warning.message);
        warn(warning);
    },
};
