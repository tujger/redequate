import {fileURLToPath} from "node:url";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const storageSourcePattern = `${sourceDirectory}**/*.js`;

const isStorageSupportChunk = chunk => chunk.moduleIds.length > 0 && chunk.moduleIds.every(id =>
    id.startsWith(sourceDirectory) || id === "\0rollupPluginBabelHelpers.js");

const entries = {
    "storage/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
    "storage/firebase": fileURLToPath(new URL("./src/firebase/index.js", import.meta.url)),
    "storage/local-test": fileURLToPath(new URL("./src/local-test/index.js", import.meta.url)),
};

// Extend the core build so Dispatcher and the neutral entry share one Context.
// This file is build-only; runtime entries never import it.
export const withStorage = config => ({
    ...config,
    input: {...config.input, ...entries},
    output: config.output.map(output => ({
        ...output,
        // Storage's native ESM imports need .mjs throughout their shared graph.
        // The web core keeps .es.js and its existing bundler interop behavior.
        chunkFileNames: chunk => {
            if (output.format === "es" && isStorageSupportChunk(chunk)) {
                return "chunks/[name]-[hash].mjs";
            }
            return typeof output.chunkFileNames === "function"
                ? output.chunkFileNames(chunk)
                : output.chunkFileNames;
        },
        entryFileNames: chunk => {
            if (Object.hasOwn(entries, chunk.name)) {
                return output.format === "cjs" ? "[name].cjs" : "[name].mjs";
            }
            return typeof output.entryFileNames === "function"
                ? output.entryFileNames(chunk)
                : output.entryFileNames || "[name].js";
        },
    })),
});
