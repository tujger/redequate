import React from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/styles/withStyles";
import ProgressView from "../../components/ProgressView";

// noinspection JSUnusedLocalSymbols
const styles = (theme) => ({
    container: {
        position: "relative",
    },
    stickyBottom: {
        position: "sticky",
        bottom: 0
    },
});

const StickyHeader = props => {
    const {classes, className, children, headerComponent, stickyBottom} = props;

    return <div className={[classes.container, className].join(" ")}>
        {headerComponent}
        {children}
        <div className={[classes.stickyBottom].join(" ")}>{stickyBottom}</div>
    </div>
};

StickyHeader.propTypes = {
    children: PropTypes.any,
};

export default withStyles(styles)(StickyHeader);
