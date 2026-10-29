import parsePath from "./parsePath";
import type {DatabasePath} from "./DatabaseTypes";

export default function resolvePath(rawPath: DatabasePath): string {
    const {path, segments} = parsePath(rawPath);
    return path.map((segment, index) => typeof segment === "string"
        ? segment : segment[segments[index].name]).join("/").split("/").filter(Boolean).join("/");
}
