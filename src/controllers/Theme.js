import createMuiTheme from "@material-ui/core/styles/createMuiTheme";
import responsiveFontSizes from "@material-ui/core/styles/responsiveFontSizes";

const drawerWidth = 240;

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

export const createTheme = ({colors, customized, mode = "day"} = {}) => {
    const customizedDefault = {
        topBottomLayout: {
            title: {},
            topmenu: {},
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

    const theme = responsiveFontSizes(createMuiTheme({
        drawerWidth: drawerWidth,
        overrides: {
            MuiDrawer: {
                paperAnchorLeft: {
                    width: drawerWidth
                }
            },
            MuiButton: {
                root: {
                    color: "rgba(0, 0, 0, 0.5)",
                },
                label: {
                    color: "inherit",
                }
            },
        },
        palette: {
            background: {
                paper: colors.paper || "#ffffff",
                default: colors.default || "#efefef",
            },
            primary: {
                main: colors.primary,
            },
            secondary: {
                main: colors.secondary,
            },
        },
        typography: {
            fontFamily: "Roboto, Helvetica, Arial, sans-serif",
            fontSize: colors.fontSize || 14,
            fontWeight: 400,
        },
        customized: {...customizedDefault},
    }));

    theme.cssMode = mode === "night" ? "night" : "day";

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
    avatarSmall: {
        height: theme.spacing(5),
        fontSize: "1rem",
        textDecoration: "none",
        width: theme.spacing(5),
    },
    label: {
        color: "#101010",
        textDecoration: "none",
    },
});
