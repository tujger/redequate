import React from "react";
import base from "./Base.module.css";
import day from "./Day.module.css";
import night from "./Night.module.css";

const ThemeContext = React.createContext({
    mode: "day",
    setMode: () => {},
    toggleMode: () => {},
});

export const useCssTheme = () => React.useContext(ThemeContext);

export default ({children, mode: givenMode = "day", onModeChange}) => {
    const [mode, setModeState] = React.useState(givenMode === "night" ? "night" : "day");
    const setMode = React.useCallback(nextMode => {
        const value = nextMode === "night" ? "night" : "day";
        setModeState(value);
        onModeChange && onModeChange(value);
    }, [onModeChange]);

    React.useEffect(() => {
        setModeState(givenMode === "night" ? "night" : "day");
    }, [givenMode]);

    React.useEffect(() => {
        const root = document.documentElement;
        root.classList.add(base.root, mode === "night" ? night.root : day.root);
        return () => {
            root.classList.remove(base.root, day.root, night.root);
        };
    }, [mode]);

    const value = React.useMemo(() => ({
        mode,
        setMode,
        toggleMode: () => setMode(mode === "night" ? "day" : "night"),
    }), [mode, setMode]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
