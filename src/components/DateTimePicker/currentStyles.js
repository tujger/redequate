export const styles = theme => {
    currentStyles = {
        calendar: {
            backgroundColor: "transparent", // grey[300],
            display: "flex !important",
            flexDirection: "column",
            lineHeight: "1.7rem",
            border: "none !important",
            [theme.breakpoints.down("xs")]: {
                fontSize: "0.875rem",
                lineHeight: "2.5rem",
            },
        },
        clockContainer: {
            backgroundColor: "transparent",
            boxShadow: "none",
        },
        clockWrapper: {
            backgroundColor: "transparent",
            boxShadow: "none",
            padding: 0
        },
        clock: {
            backgroundColor: theme.palette.background.default,
            color: theme.palette.getContrastText(theme.palette.background.default),
        },
        header: {
            backgroundColor: "transparent", // grey[300],
            borderBottomWidth: 1,
            borderBottomStyle: "solid",
            borderBottomColor: theme.palette.grey[500],
            padding: 0
        },
        current: {
            backgroundColor: theme.palette.secondary.main,
            color: theme.palette.getContrastText(theme.palette.secondary.main),
            [theme.breakpoints.down("xs")]: {
                lineHeight: "2.5rem",
                width: "2.5rem"
            },
            "&:hover": {
                backgroundColor: theme.palette.secondary.main,
                color: theme.palette.getContrastText(theme.palette.secondary.main),
            }
        },
        selected: {
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.getContrastText(theme.palette.primary.main),
            fontWeight: theme.typography.fontWeightBold,
            [theme.breakpoints.down("xs")]: {
                lineHeight: "2.5rem",
                width: "2.5rem"
            },
            "&:hover": {
                backgroundColor: theme.palette.primary.dark,
                color: theme.palette.getContrastText(theme.palette.primary.dark),
            }
        },
        range: {
            backgroundColor: theme.palette.primary.light,
            color: theme.palette.getContrastText(theme.palette.primary.light),
            [theme.breakpoints.down("xs")]: {
                lineHeight: "2.5rem",
                width: "2.5rem"
            },
            "&:hover": {
                backgroundColor: theme.palette.primary.dark,
                color: theme.palette.getContrastText(theme.palette.primary.dark),
            }
        },
        regular: {
            "&:hover": {
                backgroundColor: theme.palette.primary.dark,
                color: theme.palette.getContrastText(theme.palette.primary.dark),
            },
            [theme.breakpoints.down("xs")]: {
                lineHeight: "2.5rem",
                width: "2rem"
            },
        },
        sublabel: {
            fontSize: ".65rem",
            padding: 0,
            [theme.breakpoints.down("xs")]: {
                fontSize: ".7rem",
            },
        },
        popper: {
            paddingBottom: theme.spacing(1),
            paddingLeft: theme.spacing(1),
            paddingRight: theme.spacing(1),
        },
    };
    return currentStyles;
};
export let currentStyles = null;
