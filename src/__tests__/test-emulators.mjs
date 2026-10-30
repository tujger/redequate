import {copyFileSync, existsSync, mkdtempSync, writeFileSync} from "node:fs";
import {homedir, tmpdir} from "node:os";
import {delimiter, join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "node:child_process";
import {createServer} from "node:net";

const root = fileURLToPath(new URL("../../", import.meta.url));
const projectId = `demo-redequate-${process.pid}`;
const logDirectory = mkdtempSync(join(tmpdir(), "redequate-emulators-"));
const config = join(logDirectory, "firebase.json");
const ports = new Set();
const freePort = () => new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        server.close(error => {
            if (error) reject(error);
            else if (port < 10000 || ports.has(port)) freePort().then(resolve, reject);
            else { ports.add(port); resolve(port); }
        });
    });
});
const emulators = {};
for (const name of ["auth", "database", "hub", "logging", "eventarc", "tasks"]) {
    emulators[name] = {host: "127.0.0.1", port: await freePort()};
}
// Firebase CLI requires rules to live inside the generated config's project directory.
copyFileSync(new URL("./fixtures/database.rules.json", import.meta.url), join(logDirectory, "database.rules.json"));
writeFileSync(config, JSON.stringify({
    database: {rules: "database.rules.json"},
    emulators: {
        ...emulators,
        ui: {enabled: false},
        singleProjectMode: true,
    },
}));
const env = {...process.env, TMPDIR: logDirectory, TMP: logDirectory, TEMP: logDirectory};
const javaHome = join(homedir(), ".local/share/redequate/jdks/temurin-21/Contents/Home");
if (process.platform === "darwin" && existsSync(join(javaHome, "bin/java"))) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${join(javaHome, "bin")}${delimiter}${env.PATH || ""}`;
}
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
