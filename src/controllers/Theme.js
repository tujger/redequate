import createBreakpoints from '@material-ui/core/styles/createBreakpoints'
import {createMuiTheme} from "@material-ui/core/styles";

const drawerWidth = 240;

const breakpoints = createBreakpoints({});

const colors = () => {
    const month = new Date().getUTCMonth();
    const winterColors = {
        primary: "#4767b6",
        secondary: "#878b97",
    };
    const springColors = {
        primary: "#8a716d",
        secondary: "#c8c079",
    };
    const summerColors = {
        primary: "#678059",
        secondary: "#d0c275",
    };
    const fallColors = {
        primary: "#8e907b",
        secondary: "#dcbd8e",
    };
    return [
        winterColors, winterColors,
        springColors, springColors, springColors,
        summerColors, summerColors, summerColors,
        fallColors, fallColors, fallColors,
        winterColors
    ][month];
};

const theme = createMuiTheme({
    palette: {
        // background: {
        //     paper: "#efefef",
        //     default: "#808080",
        // },
        primary: {
            main: colors().primary,
            contrastText: "#ffffff",
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
            main: colors().secondary,
            contrastText: "#ffffff",
            "&:focus": {
                main: colors().secondary,
            },
            "&:hover": {
                main: colors().secondary,
            }
        },
    },
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
});
theme.drawerWidth = drawerWidth;

export default theme;
