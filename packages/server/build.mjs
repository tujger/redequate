import {builtinModules} from "node:module";
import {copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import {babel} from "@rollup/plugin-babel";
import del from "rollup-plugin-delete";
import json from "@rollup/plugin-json";

const source = path => fileURLToPath(new URL(path, import.meta.url));
const sharedSources = [source("../common/src/"), source("../database/src/")];
const backends = readdirSync(source("../backend/src/"), {withFileTypes: true})
    .filter(entry => entry.isDirectory() && entry.name.endsWith("-server"))
    .map(({name}) => {
        const directory = source(`../backend/src/${name}/`);
        return {
            name,
            input: {index: `${directory}${existsSync(`${directory}src/index.js`) ? "src/" : ""}index.js`},
            sources: [directory, ...sharedSources],
            manifest: `${directory}package.json`,
        };
    });

const createDependencies = outputDirectory => {
    const manifests = [source("./package.json"), ...backends.map(backend => backend.manifest).filter(existsSync)];
    let manifest;
    return {
        external: id => id.startsWith("node:") || builtinModules.includes(id) ||
            Object.keys(manifest.dependencies).some(name => id === name || id.startsWith(`${name}/`)),
        plugin: {
            name: "server-dependencies",
            buildStart() {
                for (const path of manifests) this.addWatchFile(path);
                if (manifest) return;
                const [server, ...modules] = manifests.map(path => JSON.parse(readFileSync(path, "utf8")));
                const dependencies = {...server.dependencies};
                for (const [index, backend] of modules.entries()) {
                    for (const [name, version] of Object.entries(backend.dependencies || {})) {
                        if (dependencies[name] && dependencies[name] !== version) {
                            this.error(`Conflicting dependency ${name}@${version} in ${manifests[index + 1]}; already declared as ${dependencies[name]}.`);
                        }
                        dependencies[name] = version;
                    }
                }
                const {scripts, files, ...metadata} = server;
                manifest = {
                    ...metadata,
                    dependencies,
                    exports: Object.fromEntries(
                        Object.entries(server.exports).map(([name, target]) => [name, typeof target === "string"
                            ? target.replace("./dist/", "./")
                            : Object.fromEntries(Object.entries(target).map(([format, path]) =>
                                [format, path.replace("./dist/", "./")]))])),
                };
            },
            watchChange(id) {
                if (manifests.includes(id)) manifest = undefined;
            },
        },
        packagePlugin: {
            name: "server-package",
            buildStart() {
                this.addWatchFile(source("./README.md"));
            },
            writeBundle() {
                writeFileSync(`${outputDirectory}package.json`, `${JSON.stringify(manifest, null, 4)}\n`);
                copyFileSync(source("./README.md"), `${outputDirectory}README.md`);
            },
        },
    };
};

const createBuild = ({input, output, sources, clean = [output]}, dependencies) => ({
    input,
    external: dependencies.external,
    output: ["es", "cjs"].map(format => ({
        dir: output,
        format,
        exports: "named",
        entryFileNames: format === "es" ? "[name].mjs" : "[name].cjs",
        chunkFileNames: format === "es" ? "server-chunks/[name]-[hash].mjs" : "server-chunks/[name]-[hash].cjs",
        sourcemap: true,
    })),
    plugins: [
        del({targets: clean, force: true}),
        dependencies.plugin,
        babel({
            cwd: source("../../"),
            babelHelpers: "bundled",
            babelrc: false,
            configFile: false,
            extensions: [".ts", ".tsx"],
            include: sources.map(directory => `${directory}**/*.{ts,tsx}`),
            presets: ["@babel/preset-react", ["@babel/preset-typescript", {allowDeclareFields: true}]],
        }),
        json(),
        nodeResolve({extensions: [".mjs", ".js", ".json", ".node", ".ts", ".tsx"]}),
        {
            name: "server-source-boundary",
            generateBundle() {
                for (const id of this.getModuleIds()) {
                    if (!this.getModuleInfo(id).isExternal && id !== "\0rollupPluginBabelHelpers.js" &&
                        id !== source("../common/index.js") && !sources.some(directory => id.startsWith(directory))) {
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
});

export default ({configBackend, configOutput}) => {
    const outputDirectory = configOutput ? `${resolve(configOutput)}/` : source("./dist/");
    if (configBackend && !backends.some(backend => backend.name === configBackend)) {
        throw new Error(`Unknown server Backend: ${configBackend}`);
    }
    const builds = backends.filter(backend => !configBackend || backend.name === configBackend)
        .map(backend => ({...backend, output: `${outputDirectory}backend/${backend.name}/`}));
    if (!configBackend) {
        builds.unshift({
            input: {
                "common/index": source("../common/src/index.js"),
                "database/index": source("../database/src/index.js"),
                "database/local": source("../database/src/local/index.js"),
                "backend/common": source("../backend/src/common/index.js"),
            },
            output: outputDirectory,
            sources: [source("../backend/src/common/"), ...sharedSources],
            clean: ["index.*", "common", "database", "server-chunks", "backend/common.*",
                "backend/local-server", "backend/local-server.*",
                ...backends.map(({name}) => `backend/${name}.*`)].map(path => `${outputDirectory}${path}`),
        });
    }
    const dependencies = createDependencies(outputDirectory);
    const configs = builds.map(build => createBuild(build, dependencies));
    if (!configBackend) configs.at(-1).plugins.push(dependencies.packagePlugin);
    return configs;
};
