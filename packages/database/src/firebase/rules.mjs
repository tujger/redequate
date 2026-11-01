import sourceRules from "./database.rules.json" with {type: "json"};

const own = (object, key) => Object.hasOwn(object, key);
const object = value => value !== null && typeof value === "object" &&
    !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fail = (path, reason) => { throw new Error(`Firebase Rules ${path || "/"}: ${reason}`); };
const access = new Set([".read", ".write"]);
const directives = new Set([".read", ".write", ".validate", ".indexOn"]);
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
};

function validate(node, path = "") {
    if (!object(node)) fail(path, "expected a rules object");
    let wildcards = 0;
    for (const [key, value] of Object.entries(node)) {
        const location = `${path}/${key}`;
        if (forbidden.has(key)) fail(location, "unsafe object key");
        if (key.startsWith(".")) {
            if (!directives.has(key)) fail(location, "unknown directive");
            if (key === ".indexOn") {
                const indexes = Array.isArray(value) ? value : [value];
                if (!indexes.length || indexes.some(index => typeof index !== "string" || !index ||
                    (index !== ".value" && (/[.#$[\]]/.test(index) || index.split("/").some(part => !part))))) {
                    fail(location, "expected nonempty Firebase index paths");
                }
            } else if (typeof value !== "boolean" && (typeof value !== "string" || !value.trim())) {
                fail(location, "expected a boolean or expression string");
            }
        } else {
            if (!key || (/[.#[\]/]/.test(key) || [...key].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) ||
                (key.includes("$") && !/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(key))) fail(location, "invalid child key");
            if (key.startsWith("$") && ++wildcards > 1) fail(path, "multiple wildcard children");
            validate(value, location);
        }
    }
}

function permissions(node, path = [], result = []) {
    for (const [key, value] of Object.entries(node)) {
        if (access.has(key)) result.push({path, key, value});
        else if (!key.startsWith(".")) permissions(value, [...path, key], result);
    }
    return result;
}
const overlap = (a, b) => a.length <= b.length && a.every((part, i) =>
    part === b[i] || part.startsWith("$") || b[i].startsWith("$"));

/** Pure, conservative composition. Explicit overrides acknowledge inherited grants. */
export function resolveRules(base, options = {}) {
    if (!object(base) || Object.keys(base).length !== 1 || !own(base, "rules")) fail("", "expected {rules: {...}}");
    validate(base.rules);
    if (!object(options) || Object.keys(options).some(key => !["additions", "overrides"].includes(key))) fail("", "unknown composition option");
    const {additions = {}, overrides = {}} = options;
    validate(additions);
    if (!object(overrides)) fail("", "overrides must be an object");
    const result = clone(base);
    const merge = (target, extra, path = "") => {
        for (const [key, value] of Object.entries(extra)) {
            const location = `${path}/${key}`;
            if (key === ".indexOn" && own(target, key)) {
                const indexes = [...new Set([target[key], value].flat())];
                if (!equal([target[key]].flat(), indexes)) target[key] = indexes;
            } else if (key.startsWith(".")) {
                if (own(target, key) && !equal(target[key], value)) fail(location, "conflict; use an explicit override");
                target[key] = clone(value);
            } else {
                if (!own(target, key)) target[key] = {};
                merge(target[key], value, location);
            }
        }
    };
    merge(result.rules, additions);
    const explicit = new Set();
    for (const [path, value] of Object.entries(overrides)) {
        const parts = path.split("/");
        const directive = parts.pop();
        if (parts.some(part => !part || part.startsWith(".") || forbidden.has(part)) ||
            ![".read", ".write", ".validate"].includes(directive)) fail(path, "override must address an access or validation directive");
        let node = result.rules;
        for (const part of parts) { if (!own(node, part)) node[part] = {}; node = node[part]; }
        node[directive] = clone(value);
        explicit.add(path);
    }
    validate(result.rules);
    const old = permissions(base.rules);
    const current = permissions(result.rules);
    for (const changed of current) {
        const path = [...changed.path, changed.key].join("/");
        if (explicit.has(path) || old.some(entry => equal(entry, changed))) continue;
        for (const other of current) {
            if (changed === other || changed.key !== other.key) continue;
            const related = overlap(changed.path, other.path) || overlap(other.path, changed.path);
            if (!related) continue;
            const parent = changed.path.length <= other.path.length ? changed : other;
            if (parent.value !== false || (changed.path.length === other.path.length && other.value !== false)) fail(path, `inherited ${changed.key} grant may bypass restrictions at /${other.path.join("/")}; use an explicit override`);
        }
    }
    return result;
}

export const baseRules = freeze(sourceRules);
