// Legacy Material UI consumers may read arbitrary theme paths. Keep those reads
// callable without supplying a palette, measurements, or component overrides.
const emptyValue = new Proxy(() => emptyValue, {
    apply: () => emptyValue,
    get: (target, key) => {
        if (key === Symbol.toPrimitive) return hint => hint === "number" ? 0 : "";
        if (key === Symbol.iterator) return function* () {};
        if (key === "toString") return () => "";
        if (key === "valueOf") return () => 0;
        if (key === "fallbacks" || key === "then" || key === "toJSON") return undefined;
        return emptyValue;
    },
});

const neverMatches = () => "@media not all";
const breakpoints = {
    keys: [],
    up: neverMatches,
    down: neverMatches,
    between: neverMatches,
    only: neverMatches,
    not: neverMatches,
    values: emptyValue,
};

const noopMuiTheme = new Proxy({}, {
    get: (target, key) => {
        if (key === Symbol.for("mui.nested")) return false;
        if (key === "spacing") return () => undefined;
        if (key === "breakpoints") return breakpoints;
        if (key === "mixins") return {toolbar: {minHeight: undefined}};
        if (key === "overrides" || key === "props") return undefined;
        return emptyValue;
    },
    set: () => true,
});

export default noopMuiTheme;
