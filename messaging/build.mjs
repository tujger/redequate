import {fileURLToPath} from "node:url";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const messagingSourcePattern = `${sourceDirectory}**/*.js`;

const isMessagingSupportChunk = chunk => chunk.moduleIds.length > 0 && chunk.moduleIds.every(id =>
    id.startsWith(sourceDirectory) || id === "\0rollupPluginBabelHelpers.js");

const entries = {
    "messaging/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
    "messaging/firebase": fileURLToPath(new URL("./src/firebase/index.js", import.meta.url)),
    "messaging/local-test": fileURLToPath(new URL("./src/local-test/index.js", import.meta.url)),
};

// Extend the core build so Dispatcher and the neutral entry share one Context.
// This file is build-only; runtime entries never import it.
export const withMessaging = config => ({
    ...config,
    input: {...config.input, ...entries},
    output: config.output.map(output => ({
        ...output,
        // Messaging's native ESM imports need .mjs throughout their shared graph.
        // The web core keeps .es.js and its existing bundler interop behavior.
        chunkFileNames: chunk => {
            if (output.format === "es" && isMessagingSupportChunk(chunk)) {
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
