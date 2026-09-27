import React from "react";
import {Link} from "react-router-dom";
import Pagination from "./FirebasePagination";
import {normalizeSortName} from "./UserData";
import {usePages} from "./General";
import mentionStyles from "./styles/MentionTypes.module.css";

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
    pagination: (start) => new Pagination({
        ref: "users_public",
        child: "_sort_name",
        size: 10,
        start: normalizeSortName(start),
        order: "asc"
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
    pagination: (start) => new Pagination({
        ref: "tag",
        child: "_sort_name",
        size: 10,
        start: normalizeSortName(start),
        order: "asc"
    }),
    transform: item => ({id: item.value.id, display: item.value.label}),
    trigger: "#",
    type: "tag",
    component: <ComponentTag/>
};
