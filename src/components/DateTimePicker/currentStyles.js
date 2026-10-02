export const styles = theme => {
    currentStyles = {
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
        popper: {
            paddingBottom: theme.spacing(1),
            paddingLeft: theme.spacing(1),
            paddingRight: theme.spacing(1),
        },
    };
    return currentStyles;
};
export let currentStyles = null;
