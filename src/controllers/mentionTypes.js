import React from "react";
import Pagination from "./FirebasePagination";
import {normalizeSortName} from "./UserData";
import {usePages} from "./General";
import {Link} from "react-router-dom";

const ComponentUser = ({children, display, label, id, ...rest}) => {
    const pages = usePages();
    return <Link
        to={pages.user.route + id}
        {...rest}
    >@{display || label || children}</Link>
}

const ComponentTag = ({children, display, label, id, ...rest}) => {
    const pages = usePages();
    return <Link
        to={pages.tag.route + id}
        {...rest}
    >#{display || label || children}</Link>
}

export const mentionUsers = {
    className: "Mention-user-label",
    displayTransform: (a, label) => "@" + label,
    markup: "$[user:__id__:__display__]",
    pagination: (start, firebase) => new Pagination({
        ref: firebase.database().ref("users_public"),
        child: "_sort_name",
        size: 10,
        start: normalizeSortName(start),
        order: "asc"
    }),
    style: {color: "#452187"},
    transform: item => ({id: item.key, display: item.value.name}),
    trigger: "@",
    type: "user",
    component: <ComponentUser/>
};

export const mentionTags = {
    className: "Mention-tag-label",
    displayTransform: (a, label) => "#" + label,
    markup: "$[tag:__id__:__display__]",
    pagination: (start, firebase) => new Pagination({
        ref: firebase.database().ref("tag"),
        child: "_sort_name",
        size: 10,
        start: normalizeSortName(start),
        order: "asc"
    }),
    style: {color: "#452187"},
    transform: item => ({id: item.value.id, display: item.value.label}),
    trigger: "#",
    type: "tag",
    component: <ComponentTag/>
};
