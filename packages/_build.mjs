import {fileURLToPath} from "node:url";

export const packageSourcePattern = sourceDirectory => `${sourceDirectory}**/*.js`;

const isPackageSupportChunk = (chunk, sourceDirectory) => {
    return chunk.moduleIds.length > 0 && chunk.moduleIds.every(id => {
        return id.startsWith(sourceDirectory) || id === "\0rollupPluginBabelHelpers.js";
    });
};

// Extend the core build so Dispatcher and the neutral entry share one Context.
// This file is build-only; runtime entries never import it.
export const withPackage = (entries, sourceDirectory) => config => ({
    ...config,
    input: {...config.input, ...entries},
    output: config.output.map(output => ({
        ...output,
        // Auth's native ESM imports need .mjs throughout their shared graph.
        // The web core keeps .es.js and its existing bundler interop behavior.
        chunkFileNames: chunk => {
            if (output.format === "es" && isPackageSupportChunk(chunk, sourceDirectory)) {
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
