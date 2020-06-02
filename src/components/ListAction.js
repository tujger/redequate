import React from "react";
import createStyles from "@material-ui/styles/createStyles";
import makeStyles from "@material-ui/styles/makeStyles";
import DeleteIcon from "@material-ui/icons/Delete";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";

const useStyles = makeStyles(theme => createStyles({
    itemAction: {
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        left: theme.spacing(1),
        right: theme.spacing(1),
        position: "absolute"
    },
    button: {
        color: props => props.color
    },
    buttonSelected: {
        backgroundColor: props => props.color,
        color: props => theme.palette.getContrastText(props.color),
    },
    label: {
        color: "transparent"
    },
    labelSelected: {
        color: props => props.color
    }
}));

const listAction = props => {
    const {action, itemButton, toolbarButton, variant} = props;

    const {label: itemButtonLabel, icon: itemButtonIcon = <DeleteIcon/>, color = "#00ff00"} = itemButton;
    const {label: toolbarButtonLabel, icon: toolbarButtonIcon = <DeleteIcon/>, ask} = toolbarButton;

    const classes = useStyles({color: color});

    return {
        itemButton: props => (<div
            className={classes.itemAction}
            style={props.style || ""}>
            <IconButton
                className={[classes.button, props.selected ? classes.buttonSelected : ""].join(" ")}
                children={itemButtonIcon}/>
            <span
                className={[classes.label, props.selected ? classes.labelSelected : ""].join(" ")}
                children={itemButtonLabel}/>
        </div>),
        action: action,
        toolbarButton: (<Tooltip title={toolbarButtonLabel}>
            <IconButton
                size={"medium"}
                // onClick={action}
                // onContextMenu={() => {console.log("oncontextmenu")}}
                children={toolbarButtonIcon}/>
        </Tooltip>),
        askTitle: toolbarButtonLabel,
        ask: ask,
        variant: variant,
    }
};

export default listAction;
