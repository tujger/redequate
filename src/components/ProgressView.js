import React from "react";
import LinearProgress from "@material-ui/core/LinearProgress";
import makeStyles from "@material-ui/styles/makeStyles";
import {connect} from "react-redux"

const useStyles = makeStyles(() => ({
    invisibleProgress: {
        opacity: 0,
    }
}));

const ProgressView = props => {
    const {show, value = null, className} = props;
    const classes = useStyles();

    return <LinearProgress
        color="secondary"
        variant={value === null ? "indeterminate" : "determinate"}
        value={value}
        className={[show ? "" : classes.invisibleProgress, className].join(" ")}/>
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

export default connect(mapStateToProps)(ProgressView);
