import React from "react";
import ThemeAbstract from "../ThemeAbstract";
import useTimedTheme from "../useTimedTheme";
import day from "./Day.css";
import night from "./Night.css";

// Approximate local daylight hours for winter, spring, summer, and fall.
const daylightHours = [[8, 17], [6, 19], [5, 21], [7, 18]];
const getSeason = month => Math.floor(((month + 1) % 12) / 3);
const getHours = now => daylightHours[getSeason(now.getMonth())];
const atHour = (now, hour, dayOffset = 0) => new Date(
    now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour
);

const getTheme = now => {
    const [sunrise, sunset] = getHours(now);
    return {css: now >= atHour(now, sunrise) && now < atHour(now, sunset) ? day : night};
};

const getNextUpdate = now => {
    const [sunrise, sunset] = getHours(now);
    const nextDay = atHour(now, 0, 1);
    return [atHour(now, sunrise), atHour(now, sunset), nextDay]
        .filter(date => date > now)
        .sort((a, b) => a - b)[0];
};

export default ({css, href}) => {
    const theme = useTimedTheme(getTheme, getNextUpdate);
    return <>
        <ThemeAbstract {...theme}/>
        <ThemeAbstract css={css} href={href}/>
    </>
};
