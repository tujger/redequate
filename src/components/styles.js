// eslint-disable-next-line
import React from "react";

export const styles = theme => ({
    label: {
        color: "#000000",
        textDecoration: "none",
    },
    card: {
        backgroundColor: "transparent",
        boxShadow: "none",
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderBottom: "1px solid #f6f6f6",
        borderRadius: 0,
        overflow: "initial",
        position: "relative",
    },
    cardHeader: {
        alignItems: "flex-start",
        paddingBottom: theme.spacing(1.5),
        paddingLeft: theme.spacing(.5),
        paddingRight: theme.spacing(2),
        paddingTop: theme.spacing(1.5),
    },
    cardHeaderWithLabel: {
        alignItems: "center",
    },
    cardActions: {
        display: "flex",
        justifyContent: "flex-end",
        marginTop: theme.spacing(-.5),
        paddingBottom: theme.spacing(0),
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(0),
        paddingTop: theme.spacing(0),
        [theme.breakpoints.down("sm")]: {
            justifyContent: "space-between",
            marginTop: theme.spacing(1),
            paddingBottom: theme.spacing(0),
            paddingLeft: theme.spacing(0),
            paddingRight: theme.spacing(0),
            paddingTop: theme.spacing(0),
        },
    },
    cardContent: {
        overflow: "auto"
    },
    avatar: {
        height: theme.spacing(7),
        textDecoration: "none",
        width: theme.spacing(7),
    },
    userName: {
        fontWeight: "bolder",
        marginBottom: theme.spacing(.5),
        marginRight: theme.spacing(.5),
        [theme.breakpoints.down("sm")]: {
            flex: 1,
        },
    },
    date: {
        color: "#888888",
        marginRight: theme.spacing(.5),
        [theme.breakpoints.down("sm")]: {
            fontSize: theme.spacing(1.5),
        },
    },
    icon: {
        height: theme.spacing(3),
        [theme.breakpoints.down("sm")]: {
            height: theme.spacing(2.5),
        },
    },
    since: {
        alignItems: "flex-end",
        color: "#888888",
        display: "flex",
        fontSize: "smaller",
        marginLeft: theme.spacing(1),
        [theme.breakpoints.down("sm")]: {
            fontSize: theme.spacing(1.5),
        },
    },
    body: {
        color: "#101010",
    },
    showMore: {
        color: "#452187",
        marginTop: theme.spacing(.5),
    },
    counter: {
        fontSize: theme.spacing(1.5),
        marginLeft: theme.spacing(1),
    },
    selected: {
        backgroundColor: theme.palette.background.default,
    },
    hidden: {
        visibility: "hidden",
    },
    nounderline: {
        textDecoration: "none",
    }
});
