import {fileURLToPath} from "node:url";
import {packageSourcePattern, withPackage} from "../_build.mjs";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const storageSourcePattern = packageSourcePattern(sourceDirectory, "{js,ts,tsx}");

const entries = {
    "storage/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
    "storage/firebase": fileURLToPath(new URL("./src/firebase/index.js", import.meta.url)),
    "storage/local": fileURLToPath(new URL("./src/local/index.js", import.meta.url)),
};

export const withStorage = withPackage(entries, sourceDirectory);
