import React from "react";
import ThemeAbstract from "../ThemeAbstract";
import useTimedTheme from "../useTimedTheme";
import fall from "./Fall.css";
import spring from "./Spring.css";
import summer from "./Summer.css";
import winter from "./Winter.css";

const seasons = [winter, winter, spring, spring, spring, summer, summer, summer, fall, fall, fall, winter];

const getTheme = now => ({css: seasons[now.getMonth()]});
const getNextUpdate = now => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

export default ({css, href}) => {

    const theme = useTimedTheme(getTheme, getNextUpdate);
    return <>
        <ThemeAbstract {...theme}/>
        <ThemeAbstract css={css} href={href}/>
    </>
};
