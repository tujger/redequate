import React from "react";
import {Link} from "react-router-dom";
import {usePages} from "./General";
import mentionStyles from "./styles/MentionTypes.module.css";
import {normalizeSortName} from "./UserData";

const ComponentUser = ({children, disableClick, display, label, id, className, style, ...rest}) => {
    const pages = usePages();
    return <Link
        onClick={disableClick ? undefined : event => event.stopPropagation()}
        to={disableClick ? "#" : pages.user.route + id}
        {...rest}
        className={className}
        style={style}
    >{display || label || children}</Link>
}

const ComponentTag = ({children, disableClick, display, label, id, className, style, ...rest}) => {
    const pages = usePages();
    return <Link
        onClick={disableClick ? undefined : event => event.stopPropagation()}
        to={disableClick ? "#" : pages.tag.route + id}
        {...rest}
        className={className}
        style={style}
    >{display || label || children}</Link>
}

export const mentionUsers = {
    className: mentionStyles.user,
    displayTransform: (id, display) => "@" + display,
    markup: "$[user:__id__:__display__]",
    cursor: (start, database) => database.cursor(["users_public", "user_id"], {
        orderBy: ["_sort_name"],
        start: normalizeSortName(start),
    }),
    transform: item => ({id: item.key, display: item.value.name || item.value.email}),
    trigger: "@",
    type: "user",
    component: <ComponentUser/>
};

export const mentionTags = {
    className: mentionStyles.tag,
    displayTransform: (id, display) => "#" + display,
    markup: "$[tag:__id__:__display__]",
    cursor: (start, database) => database.cursor(["tag", "tag_id"], {
        orderBy: ["_sort_name"],
        start: normalizeSortName(start),
    }),
    transform: item => ({id: item.value.id, display: item.value.label}),
    trigger: "#",
    type: "tag",
    component: <ComponentTag/>
};
