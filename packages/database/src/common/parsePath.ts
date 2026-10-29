import validatePath from "./validatePath";
import type {DatabasePath, DatabasePathSegment} from "./DatabaseTypes";

export const PATH_VARIABLE = Symbol("Path.variable");

export interface ParsedPathSegment {
    name: string;
    value: string | typeof PATH_VARIABLE;
    parameter?: string;
}

export interface ParsedPath {
    path: DatabasePathSegment[];
    literal: boolean;
    segments: ParsedPathSegment[];
}

export default function parsePath(rawPath: DatabasePath): ParsedPath {
    validatePath(rawPath);
    const literal = typeof rawPath === "string";
    const path = literal ? rawPath.split("/").filter(Boolean) : [...rawPath];
    const segments = path.map((segment, index): ParsedPathSegment => {
        const named = typeof segment !== "string";
        const name = named ? Object.getOwnPropertyNames(segment)[0] : segment;
        const value = named ? segment[name] : segment;
        const match = index > 0 ? /^\{([^{}\/]+)\}$/.exec(value) : null;
        if (match) return {name: named ? name : match[1], value: PATH_VARIABLE, parameter: match[1]};
        return {name, value: !literal && index > 0 && !named ? PATH_VARIABLE : value};
    });
    return {path, literal, segments};
}
