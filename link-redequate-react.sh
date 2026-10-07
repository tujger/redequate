#!/bin/sh

set -eu

project_root=${1:-$PWD}
project_root=$(CDPATH= cd -- "$project_root" && pwd)
library_root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

node - "$library_root" "$project_root" <<'NODE'
const [libraryRoot, projectRoot] = process.argv.slice(2);
for (const dependency of ['react', 'react-dom', 'i18next', 'react-i18next']) {
    let libraryVersion;
    let projectVersion;
    try {
        libraryVersion = require(`${libraryRoot}/node_modules/${dependency}/package.json`).version;
        projectVersion = require(`${projectRoot}/node_modules/${dependency}/package.json`).version;
    } catch (error) {
        console.error(`Missing ${dependency} in redequate or app: ${error.message}`);
        process.exitCode = 1;
        continue;
    }
    if (libraryVersion !== projectVersion) {
        console.error(`${dependency} version mismatch: redequate has ${libraryVersion}, app has ${projectVersion}`);
        process.exitCode = 1;
    }
}
NODE

for dependency in react react-dom i18next react-i18next; do
    project_dependency="$project_root/node_modules/$dependency"
    library_dependency="$library_root/node_modules/$dependency"

    if [ ! -d "$project_dependency" ]; then
        echo "Missing leading project dependency: $project_dependency" >&2
        exit 1
    fi

    if [ ! -d "$library_dependency" ]; then
        echo "Missing canonical library dependency: $library_dependency" >&2
        exit 1
    fi

    canonical_dependency=$(CDPATH= cd -- "$library_dependency" && pwd -P)
    project_dependency_realpath=$(CDPATH= cd -- "$project_dependency" && pwd -P)

    if [ "$project_dependency_realpath" = "$canonical_dependency" ]; then
        continue
    fi

    rm -rf "$project_dependency"
    ln -s "$canonical_dependency" "$project_dependency"
done

node - "$library_root" "$project_root" <<'NODE'
const fs = require('fs');
const [libraryRoot, projectRoot] = process.argv.slice(2);
for (const dependency of ['react', 'react-dom', 'i18next', 'react-i18next']) {
    const libraryPath = fs.realpathSync(require.resolve(dependency, {paths: [libraryRoot]}));
    const projectPath = fs.realpathSync(require.resolve(dependency, {paths: [projectRoot]}));
    if (libraryPath !== projectPath) {
        console.error(`${dependency} resolves differently: ${libraryPath} and ${projectPath}`);
        process.exitCode = 1;
    } else {
        console.log(`${dependency}: ${projectPath}`);
    }
}
NODE
