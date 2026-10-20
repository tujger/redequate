import validatePath from "./validatePath";
import type {DatabasePath} from "./DatabaseTypes";

/** Resolve segment values to a canonical address, ignoring _ metadata. */
export default function resolvePath(path: DatabasePath): string {
    validatePath(path);
    const resolved = typeof path === "string" ? path : path.map(segment => typeof segment === "string" ? segment
        : segment[Object.getOwnPropertyNames(segment).find(name => name !== "_")!]).join("/");
    return resolved.split("/").filter(Boolean).join("/");
}
