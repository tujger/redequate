import {fileURLToPath} from "node:url";
import {packageSourcePattern, withPackage} from "../_build.mjs";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const databaseSourcePattern = packageSourcePattern(sourceDirectory, "{js,ts,tsx}");

const entries = {
    "database/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
    "database/firebase": fileURLToPath(new URL("./src/firebase/index.js", import.meta.url)),
    "database/local": fileURLToPath(new URL("./src/local/index.js", import.meta.url)),
};

export const withDatabase = withPackage(entries, sourceDirectory);
