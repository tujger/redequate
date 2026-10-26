import {cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {watch} from "rollup";
import createBuild from "./build.mjs";

const readJSON = path => JSON.parse(readFileSync(path, "utf8"));
const dependenciesOf = manifest => JSON.stringify(Object.entries(manifest.dependencies ?? {}).sort(([a], [b]) => a.localeCompare(b)));

const prepare = functionsDirectory => {
    const functionsDir = resolve(functionsDirectory);
    const manifest = readJSON(join(functionsDir, "package.json"));
    const entry = resolve(functionsDir, manifest.main ?? "index.js");
    const installed = join(functionsDir, "node_modules/redequate-server");
    if (!existsSync(entry) || !existsSync(join(installed, "package.json")) || lstatSync(installed).isSymbolicLink()) {
        throw new Error("Prepare an installed redequate-server archive and a Functions entry point before starting the watcher.");
    }
    return {functionsDir, entry, installed, dependencies: dependenciesOf(readJSON(join(installed, "package.json")))};
};

const acquireLock = props => {
    const {installed} = props;
    const lock = join(dirname(installed), ".redequate-server-watch");
    if (existsSync(lock)) {
        const pid = Number(readFileSync(join(lock, "pid"), "utf8"));
        try {
            process.kill(pid, 0);
            throw new Error(`A redequate-server watcher is already running for this Functions directory (PID ${pid}).`);
        } catch (error) {
            if (error.code !== "ESRCH") throw error;
        }
        rmSync(lock, {recursive: true});
    }
    mkdirSync(lock);
    writeFileSync(join(lock, "pid"), String(process.pid));
    return {...props, lock};
};

const synchronize = props => {
    const {output, installed, entry, dependencies} = props;
    if (dependenciesOf(readJSON(join(output, "package.json"))) !== dependencies) {
        console.error("[Server watch] Runtime dependencies changed. Synchronization paused. Stop this watcher, run prepare-redequate-server, then start the watcher again.");
        return false;
    }
    const staging = mkdtempSync(join(dirname(installed), ".redequate-server-sync-"));
    const replacement = join(staging, "next");
    const previous = join(staging, "previous");
    try {
        cpSync(output, replacement, {recursive: true});
        if (existsSync(join(installed, "node_modules"))) {
            cpSync(join(installed, "node_modules"), join(replacement, "node_modules"), {recursive: true});
        }
        renameSync(installed, previous);
        try {
            renameSync(replacement, installed);
        } catch (error) {
            renameSync(previous, installed);
            throw error;
        }
        const now = new Date();
        utimesSync(entry, now, now);
        console.info("[Server watch] Package updated; Functions reload requested.");
        return true;
    } finally {
        rmSync(staging, {recursive: true, force: true});
    }
};

async function run(props) {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "redequate-server-watch-"));
    const state = {...props, output: join(temporaryDirectory, "dist")};
    let watcher;
    const failedBuilds = new Set();
    let building;
    let paused = false;
    let stopping = false;
    let finish;
    const stopped = new Promise(resolve => { finish = resolve; });
    const stop = () => {
        stopping = true;
        finish();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    try {
        watcher = watch(createBuild({configOutput: state.output}).map(config => ({
            ...config, watch: {buildDelay: 150},
        })));
        watcher.on("event", async event => {
            if (event.code === "BUNDLE_START") building = JSON.stringify(event.input);
            if (event.code === "BUNDLE_END") failedBuilds.delete(building);
            if (event.code === "ERROR") {
                failedBuilds.add(building);
                console.error(`[Server watch] Build failed; keeping the installed package. ${event.error.message}`);
            }
            if (event.result) await event.result.close();
            if (event.code === "END" && failedBuilds.size === 0 && !paused && !stopping) {
                try {
                    paused = !synchronize(state);
                } catch (error) {
                    console.error(`[Server watch] Synchronization failed: ${error.message}`);
                    process.exitCode = 1;
                    stop();
                }
            }
        });
        console.info(`[Server watch] Watching Redequate sources for ${props.functionsDir}`);
        await stopped;
    } finally {
        stopping = true;
        await watcher?.close();
        process.removeListener("SIGINT", stop);
        process.removeListener("SIGTERM", stop);
        rmSync(temporaryDirectory, {recursive: true, force: true});
    }
}

let props;
try {
    if (process.argv.length !== 3) throw new Error("Usage: node watch-redequate-server.mjs <functions-directory>");
    props = acquireLock(prepare(process.argv[2]));
    await run(props);
} catch (error) {
    console.error(`[Server watch] ${error.message}`);
    process.exitCode = 1;
} finally {
    if (props?.lock) rmSync(props.lock, {recursive: true, force: true});
}
