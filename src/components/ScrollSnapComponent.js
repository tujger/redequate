import React from "react";
import Grid from "@material-ui/core/Grid";
import makeStyles from "@material-ui/styles/makeStyles/makeStyles";

const stylesCurrent = ({variant}) => makeStyles(theme => ({
    item: {
        flex: "0 0 auto",
        height: theme.spacing(20),
        objectFit: "cover",
        scrollSnapAlign: "center",
        width: theme.spacing(20),
        "& img": {
            height: "100%",
        }
    },
    list: variant === "horizontal" ?
        {
            "&.MuiGrid-container": {
                boxSizing: "content-box",
                display: "flex",
                flexFlow: "nowrap",
                gap: theme.spacing(0.5),
                overflowX: "auto",
                paddingBottom: theme.spacing(1),
                scrollPadding: theme.spacing(6) + "px",
                scrollSnapType: "x mandatory",
                "-webkit-overflow-scrolling": "touch",
            }
        } : {
            display: "flex",
            flexFlow: "nowrap",
            gap: theme.spacing(0.5),
            overflowY: "auto",
            paddingBottom: theme.spacing(1),
            scrollPadding: theme.spacing(6) + "px",
            scrollSnapType: "y mandatory",
            "-webkit-overflow-scrolling": "touch",
        },
}));

export default ({classes = {}, className, items, style = {}, variant = "horizontal"}) => {
    const classesCurrent = stylesCurrent({variant})();

    return <Grid container className={[classesCurrent.list, classes.list, className].join(" ")} style={style}>
        {items.map((item, index) => <item.type
            key={index}
            {...item.props}
            className={[classesCurrent.item, classes.item, item.props.className].join(" ")}
        />)}
    </Grid>
}
