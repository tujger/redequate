import React from "react";
import {useWindowData} from "../controllers";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import SendIcon from "@material-ui/icons/Send";
import {withStyles} from "@material-ui/core";

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

const styles = theme => ({
    inputfield: {
        alignItems: "center",
        display: "flex",
        overflowX: "auto",
    },
    messagebox: {
        backgroundColor: theme.palette.background.default,
        flexWrap: "nowrap",
        [theme.breakpoints.up("md")]: {
            bottom: theme.spacing(-1),
            marginBottom: theme.spacing(-1),
            paddingBottom: theme.spacing(1),
            position: "sticky",
            width: "100%",
        },
        [theme.breakpoints.down("md")]: {
            bottom: iOS ? theme.spacing(7) : 0,
            left: 0,
            margin: 0,
            padding: theme.spacing(1),
            paddingRight: 0,
            position: "fixed",
            right: 0,
        },
    },
});

const ChatInputBox = React.forwardRef(({classes, inputComponent, onSend}, ref) => {
    const windowData = useWindowData()
    const [state, setState] = React.useState({value: ""});
    const {value} = state;

    const handleChange = evt => {
        setState({...state, value: evt.target.value});
    }

    const handleSend = () => {
        if (!value) return;
        onSend(value);
        setState({...state, value: ""})
    }

    return <Grid container ref={ref} className={classes.messagebox}>
        <Grid item xs className={classes.inputfield}>
            <inputComponent.type
                {...inputComponent.props}
                autofocus={!windowData.isNarrow()}
                color={"secondary"}
                fullWidth
                onChange={handleChange}
                onKeyUp={event => {
                    if (event.key === "Enter"/* && event.ctrlKey*/) {
                        handleSend();
                    } else if (event && event.key === "Escape") {
                        handleChange({target: {value: ""}});
                        setState(state => ({...state, value: ""}));
                    }
                }}
                value={value}
            />
        </Grid>
        <Grid item>
            <IconButton aria-label="send message" onClick={handleSend}>
                <SendIcon/>
            </IconButton>
        </Grid>
    </Grid>
})

export default withStyles(styles)(ChatInputBox)
