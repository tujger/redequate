import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {defineConfig} from "vitest/config";
import {transformWithOxc} from "vite";
import postcssNested from "postcss-nested";

const root = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({mode}) => {
    const integration = mode === "integration";
    return {
        root,
        ...(integration ? {ssr: {noExternal: [/firebase/], resolve: {conditions: ["browser"]}}} : {}),
        plugins: [{
            name: "framework-test-source",
            enforce: "pre",
            transform(code, id) {
                const filename = id.split("?")[0];
                if (["src/", "auth/src/", "_common/src/"].some(directory => filename.startsWith(`${root}${directory}`)) && filename.endsWith(".js")) {
                    return transformWithOxc(code, filename, {lang: "jsx", jsx: {runtime: "automatic"}});
                }
                if (filename.includes("/src/themes/") && filename.endsWith(".css") && !filename.endsWith(".module.css")) {
                    return {code: `export default ${JSON.stringify(readFileSync(filename, "utf8"))};`, map: null};
                }
            },
        }],
        css: {postcss: {plugins: [postcssNested()]}},
        resolve: {
            dedupe: ["react", "react-dom", "react-redux"],
            ...(integration
                ? {
                    conditions: ["browser"],
                    alias: [
                        {find: "@firebase/auth/internal", replacement: fileURLToPath(new URL("../../node_modules/@firebase/auth/dist/esm/internal.js", import.meta.url))},
                        {find: /^@firebase\/auth$/, replacement: fileURLToPath(new URL("../../node_modules/@firebase/auth/dist/esm/index.js", import.meta.url))},
                    ],
                }
                : {}),
        },
        test: {
            environment: "jsdom",
            globals: true,
            include: ["src", "auth/src", "_common/src"].map(directory =>
                `${directory}/__tests__/**/*.${integration ? "integration.test" : "test"}.js`),
            ...(!integration ? {exclude: ["**/node_modules/**", "**/*.integration.test.js"]} : {}),
            ...(integration
                ? {
                    fileParallelism: false,
                    server: {deps: {inline: [/firebase/, /@firebase/]}},
                    testTimeout: 15000,
                    hookTimeout: 30000,
                }
                : {}),
            css: {modules: {classNameStrategy: "non-scoped"}},
            restoreMocks: true,
        },
    };
});
