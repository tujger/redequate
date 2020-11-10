import React from "react";
import Pagination from "./FirebasePagination";
import {normalizeSortName} from "./UserData";
import {usePages} from "./General";
import {Link} from "react-router-dom";

const Component = ({children, display, id, ...rest}) => {
    const pages = usePages();
    return <Link
        to={pages.user.route + id}
        {...rest}
    >@{display || children}</Link>
}

export const mentionUsers = {
    className: "Mentions-user-name",
    displayTransform: (a, b) => "@" + b,
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
    component: <Component/>
};

