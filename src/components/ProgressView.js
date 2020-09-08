import React from "react";
import LinearProgress from "@material-ui/core/LinearProgress";
import {connect} from "react-redux"
import withStyles from "@material-ui/styles/withStyles";

const styles = (theme) => ({
    invisibleProgress: {
        opacity: 0,
    },
    progress: {
        [theme.breakpoints.down("sm")]: {
            bottom: theme.spacing(-0.5),
            left: 0,
            position: "absolute",
            right: 0,
        }
    }
});

const ProgressView = ({show, value = null, classes, className}) => {
    return <LinearProgress
        color={"secondary"}
        variant={value === null ? "indeterminate" : "determinate"}
        value={value}
        className={[classes.progress, show ? "" : classes.invisibleProgress, className].join(" ")}/>
};

const mapStateToProps = ({progressView}) => ({
    show: progressView.show,
    value: progressView.value
});

export default connect(mapStateToProps)(withStyles(styles)(ProgressView));
