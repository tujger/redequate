import {fileURLToPath} from "node:url";
import {packageSourcePattern, withPackage} from "../_build.mjs";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const commonSourcePattern = packageSourcePattern(sourceDirectory, "{js,ts,tsx}");

const entries = {
    "common/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
};

export const withCommon = withPackage(entries, sourceDirectory);
