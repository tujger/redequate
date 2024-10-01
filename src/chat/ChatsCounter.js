import React from "react";
import {connect} from "react-redux";
import {styles} from "../controllers/Theme";
import {withStyles} from "@mui/styles";

const ChatsCounter = ({counter, classes}) => {
    if (!counter) return null;
    return <span className={classes.badge}>{counter}</span>
}

const mapStateToProps = ({chatsCounter}) => ({
    counter: chatsCounter.counter,
});

export default connect(mapStateToProps)(withStyles(styles)(ChatsCounter));
