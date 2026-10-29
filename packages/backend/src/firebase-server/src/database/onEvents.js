import {fail} from "../../../../../common";
import {onValueCreated, onValueDeleted, onValueUpdated} from "firebase-functions/v2/database";
import parsePath, {PATH_VARIABLE} from "../../../../../database/src/common/parsePath";
import resolvePath from "../../../../../database/src/common/resolvePath.ts";

export default listener => {
    const parsed = parsePath(listener.path);
    if (!parsed.path.length) fail("database/invalid-argument", "A listener requires a nonempty path.");
    const variables = parsed.segments.flatMap((segment, index) => index > 0 && segment.value === PATH_VARIABLE
        ? [{index, field: segment.name, parameter: segment.parameter ?? segment.name}] : []);
    const names = variables.map(({parameter}) => parameter);
    if (new Set(names).size !== names.length || names.some(name => /[{}\/]/.test(name))) {
        fail("database/invalid-argument", "Listener variables must have distinct nonempty names without slashes or braces.");
    }
    const {path} = parsed;
    const fixedParams = Object.fromEntries(parsed.segments.flatMap((segment, index) => index > 0 &&
        typeof path[index] === "object" && segment.value !== PATH_VARIABLE ? [[segment.name, segment.value]] : []));
    const ref = resolvePath(path.map((segment, index) => {
        const variable = variables.find(variable => variable.index === index);
        return variable ? `{${variable.parameter}}` : segment;
    }));
    const address = `/${ref}`;
    return {
        onCreate: listener.onCreate && onValueCreated(address, ({data, params}) => listener.onCreate({value: data.val(), params: {...fixedParams, ...params}})),
        onDelete: listener.onDelete && onValueDeleted(address, ({data, params}) => listener.onDelete({value: data.val(), params: {...fixedParams, ...params}})),
        onUpdate: listener.onUpdate && onValueUpdated(address, ({data, params}) => listener.onUpdate({
            params: {...fixedParams, ...params}, previous: data.before.val(), value: data.after.val(),
        })),
    };
};
