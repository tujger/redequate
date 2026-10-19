import type {DatabasePath} from "./DatabaseBase";

export default function normalizePath(path: DatabasePath): string {
    return (path instanceof Array ? path.join("/") : path).split("/").filter(Boolean).join("/");
}
