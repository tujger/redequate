import React from "react";
import {connect} from "react-redux";
import alertCounterStyles from "./styles/AlertsCounter.module.css";

const AlertsCounter = ({counter}) => {
    if (!counter) return null;
    return <span className={alertCounterStyles.badge}>{counter}</span>
}

const mapStateToProps = ({alertsCounter}) => ({
    counter: alertsCounter.counter,
});

export default connect(mapStateToProps)(AlertsCounter);
