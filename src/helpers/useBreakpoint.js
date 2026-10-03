import React from "react";

export const getBreakpoint = width => {
    if (width >= 1920) return "xl";
    if (width >= 1280) return "lg";
    if (width >= 960) return "md";
    if (width >= 600) return "sm";
    return "xs";
};

export default givenWidth => {
    const [viewportBreakpoint, setViewportBreakpoint] = React.useState(() =>
        typeof window === "undefined" ? "md" : getBreakpoint(window.innerWidth)
    );

    React.useEffect(() => {
        const update = () => setViewportBreakpoint(getBreakpoint(window.innerWidth));
        window.addEventListener("resize", update);
        update();
        return () => window.removeEventListener("resize", update);
    }, []);

    return givenWidth || viewportBreakpoint;
};
