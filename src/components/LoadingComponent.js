import React from 'react';
import {CircularProgress, withStyles} from "@material-ui/core";
import PropTypes from "prop-types";

const styles = theme => ({
    loading: {
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        width: "100%",
    },
});

function LoadingComponent(props) {
    const {classes, text = "Loading"} = props;

    return <div className={classes.loading}>
        <h1>{text}</h1>
        <CircularProgress/>
    </div>
}

LoadingComponent.propTypes = {
    text: PropTypes.string,
};

export default withStyles(styles)(LoadingComponent);
