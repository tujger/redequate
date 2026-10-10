import {fileURLToPath} from "node:url";
import {packageSourcePattern, withPackage} from "../_build.mjs";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const authSourcePattern = packageSourcePattern(sourceDirectory);

const entries = {
    "auth/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
    "auth/firebase": fileURLToPath(new URL("./src/firebase/index.js", import.meta.url)),
    "auth/local-test": fileURLToPath(new URL("./src/local-test/index.js", import.meta.url)),
};

export const withAuth = withPackage(entries, sourceDirectory);
