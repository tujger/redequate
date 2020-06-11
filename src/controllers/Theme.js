import createMuiTheme from "@material-ui/core/styles/createMuiTheme";

const drawerWidth = 240;

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

export const createTheme = ({colors}) => createMuiTheme({
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
        }
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
    }
})

const theme = createTheme({colors:colors()});

export default theme;
