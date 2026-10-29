import {fail} from "../../../common";
import parseCommonPath, {PATH_VARIABLE} from "../common/parsePath";
import {resolveParsedPath} from "../common/resolvePath";
import type {DatabasePath, DatabasePathSegment} from "../common/DatabaseTypes";
import type {ParsedPath} from "../common/parsePath";

type PathMode = "address" | "collection" | "create" | "listener";
interface Variable {index: number; field: string; parameter: string}
interface Pattern {path: DatabasePathSegment[]; variables: Variable[]; params: Record<string, string>}

interface ProviderPath extends ParsedPath {
    effectivePath: DatabasePath;
    address: string;
    collection?: string;
    keyField?: string;
    parentPath?: DatabasePathSegment[];
    fieldName?: string;
    key?: string;
    pattern?: Pattern;
}

export default function parsePath(rawPath: DatabasePath, mode: PathMode = "address"): ProviderPath {
    if (!["address", "collection", "create", "listener"].includes(mode)) {
        fail("database/invalid-argument", "Invalid path mode.");
    }
    const parsed = parseCommonPath(rawPath);
    let effectivePath: DatabasePath = parsed.literal ? rawPath : parsed.path;
    const result: ProviderPath = {...parsed, effectivePath, address: resolveParsedPath(parsed)};
    if (mode === "create") {
        if (parsed.literal || parsed.path.length < 2) {
            fail("database/invalid-argument", "create requires a collection path followed by a key field name.");
        }
        const last = parsed.path.at(-1)!;
        const fieldName = typeof last === "string" ? last : parsed.segments.at(-1)!.name;
        result.parentPath = parsed.path.slice(0, -1);
        result.fieldName = fieldName;
        result.key = typeof last === "string" ? undefined : last[fieldName];
    }
    if (mode === "collection" && !parsed.literal && parsed.path.length > 1 && typeof parsed.path.at(-1) === "string") {
        result.keyField = parsed.path.at(-1) as string;
        effectivePath = parsed.path.slice(0, -1);
        result.effectivePath = effectivePath;
        result.address = resolveParsedPath({...parsed, path: parsed.path.slice(0, -1)});
    }
    if (mode === "listener") {
        if (!parsed.path.length) fail("database/invalid-argument", "A listener requires a nonempty path.");
        const variables = parsed.segments.flatMap((segment, index) => index > 0 && segment.value === PATH_VARIABLE
            ? [{index, field: segment.name, parameter: segment.parameter ?? segment.name}] : []);
        const names = variables.map(({parameter}) => parameter);
        if (new Set(names).size !== names.length || names.some(name => /[{}\/]/.test(name))) {
            fail("database/invalid-argument", "Listener variables must have distinct nonempty names without slashes or braces.");
        }
        const params = Object.fromEntries(parsed.segments.flatMap((segment, index) => index > 0 &&
            typeof parsed.path[index] === "object" && segment.value !== PATH_VARIABLE ? [[segment.name, segment.value]] : []));
        result.pattern = {path: parsed.path, variables, params};
    }
    if (parsed.path.length) result.collection = validateCollectionPath(parsed.path)[0] as string;
    return result;
}

// Used before superclass validation: enforce only the Local store-name rules here.
export function validateCollectionPath(rawPath: DatabasePath): DatabasePathSegment[] {
    if (typeof rawPath !== "string" && !Array.isArray(rawPath)) fail("database/invalid-argument", "Expected a collection path.");
    const path = typeof rawPath === "string" ? rawPath.split("/").filter(Boolean) : [...rawPath];
    if (!path.length) fail("database/invalid-argument", "Expected a collection path.");
    const first = path[0];
    const collection = first !== null && typeof first === "object" ? first[Object.getOwnPropertyNames(first)[0]] : first;
    if (typeof collection !== "string" || !collection || collection.includes("/") || collection.startsWith("$")) {
        fail("database/invalid-argument", "Invalid application collection.");
    }
    return [collection, ...path.slice(1)];
}
