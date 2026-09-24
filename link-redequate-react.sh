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

    if [ -L "$library_dependency" ] && [ "$(readlink "$library_dependency")" = "$project_dependency" ]; then
        continue
    fi

    rm -rf "$library_dependency"
    ln -s "$project_dependency" "$library_dependency"
done
