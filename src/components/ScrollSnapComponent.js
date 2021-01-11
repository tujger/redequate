import React from "react";
import Grid from "@material-ui/core/Grid";
import makeStyles from "@material-ui/styles/makeStyles/makeStyles";

/**
 Implementation in context of
 https://ishadeed.com/article/css-scroll-snap/
 **/

const stylesCurrent = ({align, fullHeight, variant}) => makeStyles(theme => ({
    item: variant === "horizontal" ?
        {
            flex: "0 0 auto",
            height: theme.spacing(20),
            objectFit: "cover",
            scrollSnapAlign: align,
            width: theme.spacing(20),
            "& img": {
                height: "100%",
            }
        } : {
            flex: "0 0 auto",
            height: fullHeight ? "100vh" : theme.spacing(20),
            objectFit: "cover",
            scrollSnapAlign: align,
            width: theme.spacing(20),
            "& img": {
                height: "100%",
            }
        },
    list: variant === "horizontal" ?
        {
            // "&::-webkit-scrollbar": {
            //     width: "1em",
            // },
            // "&::-webkit-scrollbar-thumb": {
            //     backgroundColor: "blue",
            // },
            "&.MuiGrid-container": {
                boxSizing: "content-box",
                display: "flex",
                flexFlow: "nowrap",
                gap: theme.spacing(0.25),
                overflowX: "auto",
                paddingBottom: theme.spacing(1),
                // scrollPadding: theme.spacing(6) + "px",
                scrollSnapType: "x mandatory",
                "-webkit-overflow-scrolling": "touch",
            }
        } : {
            "&.MuiGrid-container": {
                display: "flex",
                flexFlow: "nowrap",
                gap: theme.spacing(0.25),
                height: fullHeight ? "100vh" : undefined,
                overflowY: "auto",
                paddingBottom: theme.spacing(1),
                // scrollPadding: theme.spacing(6) + "px",
                scrollSnapType: "y mandatory",
                "-webkit-overflow-scrolling": "touch",
            }
        },
}));

export default (
    {
        align = "center",
        classes = {},
        className,
        items,
        style = {},
        variant = "horizontal",
        fullHeight = true
    }) => {
    const classesCurrent = stylesCurrent({align, fullHeight, variant})();

    return <Grid
        container
        className={[classesCurrent.list, classes.list, className].join(" ")}
        style={style}
    >
        {items.map((item, index) => <item.type
            key={index}
            {...item.props}
            className={[classesCurrent.item, classes.item, item.props.className].join(" ")}
        />)}
    </Grid>
}
