import React from "react";
import Pagination from "./FirebasePagination";
import {normalizeSortName} from "./UserData";
import {usePages} from "./General";
import {Link} from "react-router-dom";

export const mentionUsers = firebase => ({
    className: "Mentions-user-name",
    displayTransform: (a, b) => "@" + b,
    markup: "$[user:__id__:__display__]",
    pagination: (start) => new Pagination({
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
    component: <UserTextComponent/>
});

const UserTextComponent = ({children, className = "", display, id}) => {
    const pages = usePages();
    return <Link
        to={pages.user.route + id}
        className={className}
    >@{display || children}</Link>
}
