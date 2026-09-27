#!/bin/sh

set -eu

project_root=${1:-$PWD}
project_root=$(CDPATH= cd -- "$project_root" && pwd)
library_root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

for dependency in react react-dom; do
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
