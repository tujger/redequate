import createMuiTheme from "@material-ui/core/styles/createMuiTheme";

const drawerWidth = 240;
const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

export const colors = ({primary, secondary, ...rest} = {}) => {
    const month = new Date().getUTCMonth();
    const winterColors = {
        primary: primary || "#4767b6",
        secondary: secondary || "#878b97",
        ...rest
    };
    const springColors = {
        primary: primary || "#8a716d",
        secondary: secondary || "#c8c079",
        ...rest
    };
    const summerColors = {
        primary: primary || "#678059",
        secondary: secondary || "#d0c275",
        ...rest
    };
    const fallColors = {
        primary: primary || "#8e907b",
        secondary: secondary || "#dcbd8e",
        ...rest
    };
    return [
        winterColors, winterColors,
        springColors, springColors, springColors,
        summerColors, summerColors, summerColors,
        fallColors, fallColors, fallColors,
        winterColors
    ][month];
};

export const createTheme = ({colors, customized}) => {
    const customizedDefault = {
        topBottomLayout: {
            title: {
            },
            topSticky: {
                top: () => theme.mixins.toolbar.minHeight,
            }
        }
    }
    if (customized) {
        for (const x in customized) {
            customizedDefault[x] = {...customizedDefault[x], ...customized[x]};
        }
    }

    const theme = createMuiTheme({
        drawerWidth: drawerWidth,
        overrides: {
            MuiDrawer: {
                paperAnchorLeft: {
                    width: drawerWidth
                }
            },
            MuiFab: {
                primary: {
                    position: "fixed",
                    bottom: 16,
                    right: 16,
                }
            },
            MuiCard: {
                root: {
                    width: "100%"
                }
            },
            MuiButton: {
                root: {
                    color: "rgba(0, 0, 0, 0.5)",
                },
                label: {
                    color: "inherit",
                }
            }
        },
        palette: {
            background: {
                paper: colors.paper || "#ffffff",
                default: colors.default || "#efefef",
            },
            primary: {
                main: colors.primary,
                // contrastText: "#000000",
                // "&:focus": {
                //     main: "#006600",
                // },
                // "&:hover": {
                //     main: "#006600",
                // },
                // // light,
                // // dark
            },
            secondary: {
                main: colors.secondary,

                // contrastText: "#ffffff",
                "&:focus": {
                    main: colors.secondary,
                },
                "&:hover": {
                    main: colors.secondary,
                }
            },
            // background: {
            //     paper: colors.paper,
            //     default: colors.default,
            // }
        },
        typography: {
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
            fontSize: colors.fontSize || 15,
        },
        customized: {...customizedDefault},
    });
    theme.fetchOverride = (callback, defaultValue) => {
        try {
            if (callback) {
                while (callback instanceof Function) {
                    callback = callback(theme);
                }
            }
            return callback;
        } catch (e) {
            console.error(e);
            console.log("using default", defaultValue)
        }
        return defaultValue;
    };
    return theme;
}

export const styles = theme => ({
    appbar: {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.getContrastText(theme.palette.primary.main),
    },

    badge: {
        color: "#ff0000",
        fontSize: "small",
        fontWeight: "bolder",
        marginBottom: theme.spacing(0.5),
        marginLeft: theme.spacing(0.5),
        verticalAlign: "super",
    },
    buttonBack: {
        backgroundColor: "red"
    },
    fab: {
        backgroundColor: theme.palette.secondary.main,
        color: theme.palette.getContrastText(theme.palette.secondary.main),
        zIndex: 1,
        bottom: iOS ? theme.spacing(9) : theme.spacing(2),
        "&:hover": {
            backgroundColor: theme.palette.secondary.main,
            color: theme.palette.getContrastText(theme.palette.secondary.main),
        },
        "& ~ $fabUpper": {
            marginBottom: iOS ? theme.spacing(17) : theme.spacing(8),
        }
    },
    fabUpper: {
        backgroundColor: theme.palette.secondary.main,
        color: theme.palette.getContrastText(theme.palette.secondary.main),
        zIndex: 1,
        bottom: iOS ? theme.spacing(9) : theme.spacing(2),
        "&:hover": {
            backgroundColor: theme.palette.secondary.main,
            color: theme.palette.getContrastText(theme.palette.secondary.main),
        },
    },
    label: {
        color: "#101010",
        textDecoration: "none",
    },
    link: {
        color: "#3f51b5",
    },
    nounderline: {
        textDecoration: "none",
    },
    profileFields: {
        alignItems: "center",
        [theme.breakpoints.up("sm")]: {
            flex: 1,
            justifyContent: "flex-start",
            width: "auto",
        },
        [theme.breakpoints.down("sm")]: {
            display: "flex",
            flexFlow: "column",
            marginBottom: theme.spacing(2),
            width: "100%",
        },
    },
    profileField: {
        [theme.breakpoints.up("sm")]: {
            justifyContent: "flex-start",
            width: "auto",
        },
        [theme.breakpoints.down("sm")]: {
            alignItems: "center",
            display: "inline",
            justifyContent: "center",
            textAlign: "center",
        },
    },
    profileImage: {
        [theme.breakpoints.up("sm")]: {
            width: theme.spacing(18),
            height: theme.spacing(18),
            maxHeight: theme.spacing(18),
            maxWidth: theme.spacing(30),
        },
        [theme.breakpoints.down("sm")]: {
            width: theme.spacing(25),
            height: theme.spacing(25),
            maxHeight: theme.spacing(25),
            maxWidth: "100%",
        },
        color: "darkgray",
        objectFit: "cover"
    },
    profileImageContainer: {
        [theme.breakpoints.up("sm")]: {
            marginRight: theme.spacing(2),
        },
        [theme.breakpoints.down("sm")]: {
            alignItems: "center",
            display: "flex",
            justifyContent: "center",
            width: "100%",
            // marginTop: theme.spacing(3),
        },
    },
    searchIcon: {},
    searchToolbar: {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.getContrastText(theme.palette.background.default),
        position: "absolute",
        right: 0,
        zIndex: 1,
        [theme.breakpoints.up("md")]: {
            paddingRight: theme.spacing(2),
        },
        [theme.breakpoints.down("sm")]: {
            bottom: 0,
            left: 0,
            paddingRight: theme.spacing(1),
            top: 0,
        }
    },
    searchToolbarBack: {},
    searchToolbarIcon: {},
    searchToolbarInput: {
        [theme.breakpoints.up("md")]: {
            width: theme.spacing(32),
        },
    },
    superIndex: {
        color: "#ff0000",
        fontSize: "small",
        fontWeight: "bolder",
        marginBottom: theme.spacing(0.5),
        marginLeft: theme.spacing(0.5),
        verticalAlign: "super",
    },
    tabButton: {
        borderBottomColor: "transparent",
        borderBottomStyle: "solid",
        borderBottomWidth: theme.spacing(0.25),
        borderRadius: 0,
        fontSize: "90%",
        whiteSpace: "nowrap",
        [theme.breakpoints.down("sm")]: {
            flex: "1 0 auto",
        },
    },
    tabButtonSelected: {
        borderBottomColor: theme.palette.secondary.main,
        color: theme.palette.secondary.main,
    },
    text: {
        textDecoration: "none",
    },

    header: {},
    footer: {},
    bottom: {},
    bottomSticky: {},
    center: {},
    left: {},
    right: {},
    top: {},
    topSticky: {},
})

export const stylesList = theme => ({
    avatar: {
        boxSizing: "border-box",
        color: "lightgray",
        height: theme.spacing(7),
        textDecoration: "none",
        width: theme.spacing(7),
    },
    avatarSmall: {
        height: theme.spacing(5),
        fontSize: "1rem",
        textDecoration: "none",
        width: theme.spacing(5),
    },
    avatarSmallest: {
        height: theme.spacing(3),
        fontSize: "0.8rem",
        textDecoration: "none",
        width: theme.spacing(3),
    },
    card: {
        backgroundColor: theme.palette.background.paper,
        borderWidth: 0,
        boxShadow: theme.shadows[8],
        marginBottom: theme.spacing(1.5),
        overflow: "initial",
        position: "relative",
        "& $root, & > $cardHeader, & > .MuiCollapse-container": {
            boxSizing: "border-box",
            padding: theme.spacing(1),
            "& > .MuiCollapse-container": {
                paddingTop: theme.spacing(1),
            },
            [theme.breakpoints.down("sm")]: {
                // paddingBottom: 0,
            },
        },
        "& $cardHeader": {
        },
    },
    cardCloud: {
        backgroundColor: "transparent",
        boxShadow: "none",
        marginBottom: theme.spacing(1),
        "& $root, & > $cardHeader, & > .MuiCollapse-container": {
            boxSizing: "border-box",
            "& > .MuiCollapse-container": {
                paddingTop: theme.spacing(1),
            },
            [theme.breakpoints.down("sm")]: {
                padding: 0,
            },
        },
        "& $cardContent": {
            backgroundColor: theme.palette.background.paper,
            borderRadius: theme.spacing(2),
            padding: theme.spacing(1),
            paddingLeft: theme.spacing(2),
            paddingRight: theme.spacing(2),
        },
        "& .MuiCardHeader-avatar": {
            marginRight: theme.spacing(1.5),
        },
        "& $cardActions": {
            marginLeft: 0,
            marginRight: 0,
            paddingBottom: 0,
        }
        // marginTop: theme.spacing(0.5),
    },
    cardFlat: {
        // borderBottom: "1px solid #f6f6f6",
        borderRadius: 0,
        boxShadow: "none",
        marginBottom: 2,
    },
    cardTransparent: {
        backgroundColor: "transparent",
        boxShadow: "none",
        marginBottom: theme.spacing(0.5),
    },
    cardActions: {
        display: "flex",
        [theme.breakpoints.up("md")]: {
            justifyContent: "flex-end",
            "& .MuiSvgIcon-root": {
                height: theme.spacing(2.5),
            }
        },
        [theme.breakpoints.down("sm")]: {
            justifyContent: "space-between",
            marginLeft: theme.spacing(1),
            marginRight: theme.spacing(1),
            // marginTop: theme.spacing(1),
            paddingBottom: theme.spacing(1.2),
            paddingTop: theme.spacing(1.2),
            "& .MuiSvgIcon-root": {
                height: theme.spacing(2.5),
            }
        },
    },
    cardActionsSmall: {
        [theme.breakpoints.up("md")]: {
            "& .MuiSvgIcon-root": {
                height: theme.spacing(2),
            },
        },
        [theme.breakpoints.down("sm")]: {
            "& .MuiSvgIcon-root": {
            },
        },
    },
    cardHeader: {
        alignItems: "flex-start",
        padding: 0,
        // paddingBottom: theme.spacing(1.5),
        // paddingLeft: theme.spacing(1),
        // paddingRight: theme.spacing(2),
        // paddingTop: theme.spacing(1.5),
        // [theme.breakpoints.up("md")]: {
        // },
        // [theme.breakpoints.down("sm")]: {
        // },
        "&$reply": {
            alignItems: "flex-start",
        }
    },
    cardHeaderWithLabel: {
        alignItems: "center",
        whiteSpace: "pre-wrap",
    },
    cardSubheader: {
        color: "#101010",
    },
    cardContent: {
        overflow: "auto"
    },
    cardImage: {
        flex: 1,
        height: "auto",
        maxHeight: "100%",
        maxWidth: "100%",
        objectFit: "contain",
        objectPosition: "left",
        overflow: "auto",
        position: "relative",
        width: "auto",
        [theme.breakpoints.up("md")]: {
            marginTop: theme.spacing(1),
        },
        [theme.breakpoints.down("sm")]: {},
    },
    counter: {
        fontSize: theme.spacing(1.5),
        marginLeft: theme.spacing(1),
    },
    date: {
        color: "#888888",
        marginRight: theme.spacing(0.5),
        [theme.breakpoints.down("sm")]: {
            fontSize: theme.spacing(1.5),
        },
    },
    hidden: {
        visibility: "hidden",
    },
    icon: {
        [theme.breakpoints.up("md")]: {
            height: theme.spacing(3),
        },
        [theme.breakpoints.down("sm")]: {
            height: theme.spacing(2.5),
        },
    },
    iconSmall: {
        [theme.breakpoints.up("md")]: {
            height: theme.spacing(2),
        },
        // [theme.breakpoints.down("sm")]: {
        //     height: theme.spacing(2.5),
        // },
    },
    label: {
        color: "inherit",
        textDecoration: "none",
    },
    link: {
        color: "#3f51b5",
    },
    nounderline: {
        textDecoration: "none",
    },
    read: {
        color: "#888888",
    },
    reply: {

    },
    root: {
        flex: "0 0 auto"
    },
    selected: {
        backgroundColor: theme.palette.background.default,
    },
    showMore: {
        color: "#3f51b5",
        marginTop: theme.spacing(0.5),
    },
    since: {
        alignItems: "flex-end",
        color: "#888888",
        display: "flex",
        marginLeft: theme.spacing(1),
        [theme.breakpoints.up("md")]: {
            fontSize: "smaller",
        },
        [theme.breakpoints.down("sm")]: {
            fontSize: theme.spacing(1.5),
        },
    },
    text: {
        color: "#101010",
        textDecoration: "none",
        "&:empty": {
            borderWidth: 0,
            height: 0,
            margin: 0,
            padding: 0,
        }
    },
    unread: {
        color: "#101010",
        fontWeight: "bolder",
    },
    userName: {
        color: "#3f51b5",
        fontWeight: "bolder",
        marginRight: theme.spacing(0.5),
        textDecoration: "none",
        [theme.breakpoints.down("sm")]: {
            // flex: 0,
        },
    },
});

// const theme = createTheme({colors: colors(), customized: customizedDefault});
//
// export default theme;
