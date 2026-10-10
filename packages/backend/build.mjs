import {fileURLToPath} from "node:url";
import {packageSourcePattern, withPackage} from "../_build.mjs";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const backendSourcePattern = packageSourcePattern(sourceDirectory);

const entries = {
    "backend/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
    "backend/firebase-client": fileURLToPath(new URL("./src/firebase-client/index.js", import.meta.url)),
    "backend/local-test-client": fileURLToPath(new URL("./src/local-test-client/index.js", import.meta.url)),
};

export const withBackend = withPackage(entries, sourceDirectory);
