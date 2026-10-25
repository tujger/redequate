import {fileURLToPath} from "node:url";
import {babel} from "@rollup/plugin-babel";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import del from "rollup-plugin-delete";

const source = path => fileURLToPath(new URL(path, import.meta.url));
const output = source("../../../../core/backend/");
const sources = [source("./src/"), source("../../../database/src/"), source("../../../common/src/")];

export default {
    input: {
        "local-server": source("./src/index.js"),
        "local-server-worker": source("./src/local-server-worker.mjs"),
    },
    output: {
        dir: output,
        format: "es",
        entryFileNames: "[name].mjs",
        chunkFileNames: "local-server-chunks/[name]-[hash].mjs",
        sourcemap: true,
    },
    plugins: [
        del({targets: [`${output}local-server{,-worker}.mjs{,.map}`, `${output}local-server-chunks`]}),
        babel({
            babelHelpers: "bundled",
            babelrc: false,
            configFile: false,
            extensions: [".ts", ".tsx"],
            presets: [["@babel/preset-typescript", {allowDeclareFields: true}]],
        }),
        json(),
        nodeResolve({extensions: [".mjs", ".js", ".ts", ".tsx", ".json"]}),
        {
            name: "local-server-worker-boundary",
            generateBundle() {
                for (const id of this.getModuleIds()) {
                    if (id !== "\0rollupPluginBabelHelpers.js" && id !== source("../../../common/index.js") &&
                        !sources.some(directory => id.startsWith(directory))) {
                        this.error(`Local Server cannot include Node, client or UI modules: ${id}`);
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
