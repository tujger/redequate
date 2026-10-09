import {readFileSync} from "node:fs";
import {defineConfig, transformWithOxc} from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    base: "/redequate/",
    plugins: [{
        name: "jsx-in-js",
        enforce: "pre",
        transform(code, id) {
            const filename = id.split("?")[0];
            if (filename.includes("/example/src/") && filename.endsWith(".js")) {
                return transformWithOxc(code, filename, {lang: "jsx", jsx: {runtime: "automatic"}});
            }
        },
    }, react()],
    resolve: {
        dedupe: Object.keys(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).peerDependencies),
    },
    build: {outDir: "build"},
});
