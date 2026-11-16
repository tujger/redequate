import parsePath from "./parsePath";
import type {ParsedPath} from "./parsePath";
import type {DatabasePath} from "./DatabaseTypes";

export function resolveParsedPath({path, segments}: ParsedPath): string {
    return path.map((segment, index) => typeof segment === "string"
        ? segment : segment[segments[index].name]).join("/").split("/").filter(Boolean).join("/");
}

export default function resolvePath(rawPath: DatabasePath): string {
    return resolveParsedPath(parsePath(rawPath));
}
