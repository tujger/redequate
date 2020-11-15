import createMuiTheme from "@material-ui/core/styles/createMuiTheme";

const drawerWidth = 240;
const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

export const colors = ({primary, secondary} = {}) => {
    const month = new Date().getUTCMonth();
    const winterColors = {
        primary: primary || "#4767b6",
        secondary: secondary || "#878b97",
    };
    const springColors = {
        primary: primary || "#8a716d",
        secondary: secondary || "#c8c079",
    };
    const summerColors = {
        primary: primary || "#678059",
        secondary: secondary || "#d0c275",
    };
    const fallColors = {
        primary: primary || "#8e907b",
        secondary: secondary || "#dcbd8e",
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
        },
        palette: {
            background: {
                paper: "#efefef",
                default: "#ffffff",
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
            fontSize: 15,
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
        color: "#000000",
        textDecoration: "none",
    },
    link: {
        color: "#452187",
    },
    nounderline: {
        textDecoration: "none",
    },
    profileFields: {
        [theme.breakpoints.up("sm")]: {
            flex: 1,
            marginLeft: theme.spacing(4),
            width: "auto",
        },
        [theme.breakpoints.down("sm")]: {
            marginBottom: theme.spacing(3),
        },
    },
    profileField: {
        [theme.breakpoints.down("sm")]: {
            alignItems: "center",
            justifyContent: "center",
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
            width: theme.spacing(15),
            height: theme.spacing(15),
            maxHeight: theme.spacing(15),
            maxWidth: theme.spacing(30),
        },
        color: "darkgray",
        objectFit: "cover"
    },
    profileImageContainer: {
        [theme.breakpoints.up("sm")]: {
            width: "auto",
        },
        [theme.breakpoints.down("sm")]: {
            alignItems: "center",
            justifyContent: "center",
            marginTop: theme.spacing(3),
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
        whiteSpace: "nowrap",
    },
    tabButtonSelected: {
        borderBottomColor: theme.palette.secondary.main,
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
        height: theme.spacing(7),
        textDecoration: "none",
        width: theme.spacing(7),
    },
    avatarSmall: {
        height: theme.spacing(4),
        textDecoration: "none",
        width: theme.spacing(4),
    },
    avatarSmallest: {
        height: theme.spacing(3),
        textDecoration: "none",
        width: theme.spacing(3),
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
    cardActions: {
        display: "flex",
        paddingBottom: theme.spacing(0),
        paddingRight: theme.spacing(0),
        paddingTop: theme.spacing(0),
        [theme.breakpoints.up("md")]: {
            justifyContent: "flex-end",
            // marginTop: theme.spacing(-0.5),
            paddingLeft: theme.spacing(1),
            "& .MuiSvgIcon-root": {
                height: theme.spacing(2.5),
            }
        },
        [theme.breakpoints.down("sm")]: {
            justifyContent: "space-between",
            marginTop: theme.spacing(1),
            paddingLeft: theme.spacing(0),
            "& .MuiSvgIcon-root": {
                height: theme.spacing(2.5),
            }
        },
    },
    cardActionsSmall: {
        display: "flex",
        paddingBottom: theme.spacing(0),
        paddingRight: theme.spacing(0),
        paddingTop: theme.spacing(0),
        [theme.breakpoints.up("md")]: {
            justifyContent: "flex-end",
            marginTop: theme.spacing(-0.5),
            paddingLeft: theme.spacing(1),
            "& .MuiSvgIcon-root": {
                height: theme.spacing(2),
            },
        },
        [theme.breakpoints.down("sm")]: {
            justifyContent: "space-between",
            marginTop: theme.spacing(1),
            paddingLeft: theme.spacing(0),
            "& .MuiSvgIcon-root": {
                height: theme.spacing(2.5),
            },
        },
    },
    cardHeader: {
        alignItems: "flex-start",
        paddingBottom: theme.spacing(1.5),
        paddingLeft: theme.spacing(0.5),
        paddingRight: theme.spacing(2),
        paddingTop: theme.spacing(1.5),
    },
    cardHeaderWithLabel: {
        alignItems: "center",
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
        marginTop: theme.spacing(1),
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
        color: "#000000",
        textDecoration: "none",
    },
    link: {
        color: "#452187",
    },
    nounderline: {
        textDecoration: "none",
    },
    read: {
        color: "#888888",
    },
    root: {
        flex: "0 0 auto"
    },
    selected: {
        backgroundColor: theme.palette.background.default,
    },
    showMore: {
        color: "#452187",
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
        textDecoration: "none",
        "&:empty": {
            borderWidth: 0,
            height: 0,
            margin: 0,
            padding: 0,
        }
    },
    unread: {
        color: "#000000",
        fontWeight: "bolder",
    },
    userName: {
        fontWeight: "bolder",
        marginRight: theme.spacing(0.5),
        textDecoration: "none",
        [theme.breakpoints.down("sm")]: {
            flex: 1,
        },
    },
});

// const theme = createTheme({colors: colors(), customized: customizedDefault});
//
// export default theme;
