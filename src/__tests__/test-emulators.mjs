import {copyFileSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const projectId = "demo-redequate-tests";
const logDirectory = mkdtempSync(join(tmpdir(), "redequate-emulators-"));
const config = join(logDirectory, "firebase.json");
// Firebase CLI requires rules to live inside the generated config's project directory.
copyFileSync(new URL("./fixtures/database.rules.json", import.meta.url), join(logDirectory, "database.rules.json"));
writeFileSync(config, JSON.stringify({
    database: {rules: "database.rules.json"},
    emulators: {
        auth: {host: "127.0.0.1", port: 9099},
        database: {host: "127.0.0.1", port: 9000},
        ui: {enabled: false},
        singleProjectMode: true,
    },
}));
const env = {...process.env};
delete env.GOOGLE_APPLICATION_CREDENTIALS;
delete env.FIREBASE_CONFIG;
delete env.FIREBASE_TOKEN;

// emulators:exec accepts a shell command; quote every argument as a literal.
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const testCommand = [process.execPath, join(root, "node_modules/vitest/vitest.mjs")];
testCommand.push(process.argv.includes("--watch") ? "--watch" : "run");
testCommand.push("--root", root, "--config", join(root, "src/__tests__/vitest.config.mjs"), "--mode", "integration");
console.info(`Firebase emulator logs: ${logDirectory}`);
const child = spawn(process.execPath, [
    join(root, "node_modules/firebase-tools/lib/bin/firebase.js"),
    "emulators:exec", "--config", config,
    "--project", projectId, "--only", "auth,database",
    testCommand.map(quote).join(" "),
], {cwd: logDirectory, env, stdio: "inherit", detached: process.platform !== "win32"});
const stop = signal => {
    if (!child.pid) return;
    if (process.platform === "win32") return child.kill(signal);
    try {
        process.kill(-child.pid, signal);
    } catch (error) {
        if (error.code !== "ESRCH") throw error;
    }
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("error", error => {
    console.error(error);
    process.exitCode = 1;
});
child.on("exit", code => {process.exitCode = code ?? 1;});
