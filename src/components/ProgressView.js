import React from "react";
import LinearProgress from "@material-ui/core/LinearProgress";
import makeStyles from "@material-ui/styles/makeStyles";
import {connect} from "react-redux"

const useStyles = makeStyles(() => ({
    invisibleProgress: {
        display: "none",
    }
}));

const ProgressView = props => {
    const {show, className} = props;
    const classes = useStyles();

    return <LinearProgress
        className={[show ? "" : classes.invisibleProgress, className].join(" ")}/>
};

ProgressView.SHOW = {type:"show"};
ProgressView.HIDE = {type:"hide"};

export const progressView = (state = {show:false}, action) => {
    switch(action.type) {
        case ProgressView.SHOW.type:
            return {show: true};
        case ProgressView.HIDE.type:
            return {show: false};
        default:
            return state;
    }
};

const mapStateToProps = ({progressView}) => ({show: progressView.show});

export default connect(mapStateToProps)(ProgressView);
