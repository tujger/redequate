import {fileURLToPath} from "node:url";
import {packageSourcePattern, withPackage} from "../_build.mjs";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const messagingSourcePattern = packageSourcePattern(sourceDirectory);

const entries = {
    "messaging/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
    "messaging/firebase": fileURLToPath(new URL("./src/firebase/index.js", import.meta.url)),
    "messaging/local-test": fileURLToPath(new URL("./src/local-test/index.js", import.meta.url)),
};

export const withMessaging = withPackage(entries, sourceDirectory);
