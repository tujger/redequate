import React from "react";
import LinearProgress from "@material-ui/core/LinearProgress";
import {connect} from "react-redux"
import withStyles from "@material-ui/styles/withStyles";

const styles = theme => ({
    invisibleProgress: {
        opacity: 0,
    },
    progress: {
        // bottom: theme.spacing(-0.5),
        bottom: 0,
        left: 0,
        position: "absolute",
        right: 0,
        // [theme.breakpoints.down("sm")]: {
        // }
    }
});

const ProgressView = ({show, value = null, classes, className}) => {
    return <LinearProgress
        color={"secondary"}
        variant={value === null ? "indeterminate" : "determinate"}
        value={value}
        className={[classes.progress, show ? "" : classes.invisibleProgress, className].join(" ")}/>
};

ProgressView.SHOW = {type: "progressView_Show"};
ProgressView.HIDE = {type: "progressView_Hide"};

export const progressViewReducer = (state = {show: false, value: null}, action) => {
    switch (action.type) {
        case ProgressView.SHOW.type:
            if (action.value) {
                return {show: true, value: +action.value};
            } else {
                return {show: true, value: null};
            }
        case ProgressView.HIDE.type:
            return {show: false, value: null};
        default:
            return state;
    }
};

const mapStateToProps = ({progressView}) => ({
    show: progressView.show,
    value: progressView.value
});

export default connect(mapStateToProps)(withStyles(styles)(ProgressView));
