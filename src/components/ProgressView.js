import React from "react";
import {connect} from "react-redux";
import styles from "./styles/ProgressView.module.css";

const ProgressView = ({show, value = null, className}) => {
    const indeterminate = value === null;

    return <div
        aria-valuemax={indeterminate ? undefined : 100}
        aria-valuemin={indeterminate ? undefined : 0}
        aria-valuenow={indeterminate ? undefined : value}
        className={[
            styles.progress,
            indeterminate ? styles.indeterminate : styles.determinate,
            !show && styles.hidden,
            className,
        ].filter(Boolean).join(" ")}
        role={"progressbar"}
        style={indeterminate ? undefined : {"--progress-value": `${value}%`}}
    >
        <span className={styles.bar}/>
        {indeterminate && <span className={styles.barSecond}/>}
    </div>;
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
