import React from "react";
import {connect} from "react-redux";
import useTheme from "@material-ui/styles/useTheme";
import {makeStyles} from "@material-ui/core/styles";

export const useStyles = theme => makeStyles({
    badge: {
        color: "#ff0000",
        fontSize: "small",
        fontWeight: "bolder",
        marginBottom: theme.spacing(0.5),
        marginLeft: theme.spacing(0.5),
        verticalAlign: "super",
    }
})

const ChatsCounter = ({counter}) => {
    const theme = useTheme();
    const classes = useStyles(theme)({});
    if (!counter) return null;
    return <span className={classes.badge}>{counter}</span>
}

const mapStateToProps = ({chatsCounterReducer}) => ({
    counter: chatsCounterReducer.counter,
});

export default connect(mapStateToProps)(ChatsCounter);
