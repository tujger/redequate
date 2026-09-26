import React from "react";
import {connect} from "react-redux";
import chatCounterStyles from "./styles/ChatsCounter.module.css";

const ChatsCounter = ({counter}) => {
    if (!counter) return null;
    return <span className={chatCounterStyles.badge}>{counter}</span>
}

const mapStateToProps = ({chatsCounter}) => ({
    counter: chatsCounter.counter,
});

export default connect(mapStateToProps)(ChatsCounter);
