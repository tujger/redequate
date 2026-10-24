import {fileURLToPath} from "node:url";
import {packageSourcePattern, withPackage} from "../_build.mjs";

const sourceDirectory = fileURLToPath(new URL("./src/", import.meta.url));
export const backendSourcePattern = packageSourcePattern(sourceDirectory, "{js,ts,tsx}");

const entries = {
    "backend/index": fileURLToPath(new URL("./src/index.js", import.meta.url)),
    "backend/common": fileURLToPath(new URL("./src/common/index.js", import.meta.url)),
    "backend/firebase-client": fileURLToPath(new URL("./src/firebase-client/index.js", import.meta.url)),
    "backend/local-client": fileURLToPath(new URL("./src/local-client/index.js", import.meta.url)),
};

const withBackendPackage = withPackage(entries, sourceDirectory);

export const withBackend = config => {
    const clientConfig = withBackendPackage(config);
    return {
        ...clientConfig,
        plugins: [...clientConfig.plugins, {
            name: "backend-client-boundary",
            moduleParsed({id}) {
                if (id.startsWith(sourceDirectory) && /^(common-server|firebase-server|local-server)\//.test(id.slice(sourceDirectory.length))) {
                    this.error(`Browser build cannot import server Backend modules: ${id}`);
                }
            },
        }],
    };
};
