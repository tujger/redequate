import React from "react";
import {connect} from "react-redux";
import {useTheme} from "@material-ui/styles";
import {makeStyles} from "@material-ui/core/styles";
import {Layout} from "../controllers/Store";

export const useStyles = theme => makeStyles({
    badge: {
        color: "#ff0000",
        fontSize: "small",
        fontWeight: "bolder",
        marginBottom: theme.spacing(.5),
        marginLeft: theme.spacing(.5),
        verticalAlign: "super",
    }
})

const ChatsCounter = ({counter}) => {
    const theme = useTheme();
    const classes = useStyles(theme)({});
    if (!counter) return null;
    return <span className={classes.badge}>{counter}</span>
}
ChatsCounter.COUNTER = "chatsCounter_Counter";

export const chatsCounterReducer = (state = {counter: 0}, action) => {
    switch (action.type) {
        case ChatsCounter.COUNTER:
            return {...state, counter: action.counter};
        case Layout.REFRESH:
            return {...state, random: Math.random()};
        default:
            return state;
    }
};
chatsCounterReducer.skipStore = true;

const mapStateToProps = ({chatsCounterReducer}) => ({
    counter: chatsCounterReducer.counter,
});

export default connect(mapStateToProps)(ChatsCounter);
