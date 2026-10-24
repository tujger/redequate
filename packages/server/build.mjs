import {builtinModules} from "node:module";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import {babel} from "@rollup/plugin-babel";
import del from "rollup-plugin-delete";

const source = path => fileURLToPath(new URL(path, import.meta.url));
const outputDirectory = source("./dist/");
const manifest = JSON.parse(readFileSync(source("./package.json"), "utf8"));
const dependencies = Object.keys(manifest.dependencies || {});
const backendNames = ["common", "common-server", "firebase-server", "local-server"];
const directories = [
    source("./src/"),
    source("../common/src/"),
    source("../database/src/"),
    ...backendNames
        .map(name => source(`../backend/src/${name}/`)),
];

const entries = {
    index: source("./src/index.js"),
    "common/index": source("../common/src/index.js"),
    ...Object.fromEntries(["index", "firebase", "local"]
        .map(name => [`database/${name}`, source(`../database/src/${name === "index" ? "index.js" : `${name}/index.js`}`)])),
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
        babel({
            babelHelpers: "bundled",
            babelrc: false,
            configFile: false,
            extensions: [".ts", ".tsx"],
            include: directories.map(directory => `${directory}**/*.{ts,tsx}`),
            presets: ["@babel/preset-react", ["@babel/preset-typescript", {allowDeclareFields: true}]],
        }),
        nodeResolve({extensions: [".mjs", ".js", ".json", ".node", ".ts", ".tsx"]}),
        {
            name: "server-source-boundary",
            generateBundle() {
                for (const id of this.getModuleIds()) {
                    if (!this.getModuleInfo(id).isExternal && id !== "\0rollupPluginBabelHelpers.js" && id !== source("../common/index.js") && !directories.some(directory => id.startsWith(directory))) {
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
