import React from "react";

export default (getTheme, getNextUpdate) => {
    const [themeModule, setThemeModule] = React.useState(() => getTheme(new Date()));

    React.useEffect(() => {
        let timer;

        const update = () => {
            const now = new Date();
            setThemeModule(getTheme(now));
            timer = setTimeout(update, Math.max(1, getNextUpdate(now).getTime() - now.getTime()));
        };

        const onVisibilityChange = () => {
            if (document.hidden) return;
            clearTimeout(timer);
            update();
        };

        update();
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [getTheme, getNextUpdate]);

    return themeModule;
};
