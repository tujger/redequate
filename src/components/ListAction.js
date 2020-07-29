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
        action: action,
        ask: ask,
        askTitle: toolbarButtonLabel,
        itemButton: props => (<div
            className={classes.itemAction}
            style={props.style || ""}>
            <IconButton
                children={itemButtonIcon}
                className={[classes.button, props.selected ? classes.buttonSelected : ""].join(" ")}
            />
            <span
                children={itemButtonLabel}
                className={[classes.label, props.selected ? classes.labelSelected : ""].join(" ")}
            />
        </div>),
        toolbarButton: (<Tooltip title={toolbarButtonLabel}>
            <IconButton
                children={toolbarButtonIcon}
                size={"medium"}
                // onClick={action}
                // onContextMenu={() => {console.log("oncontextmenu")}}
            />
        </Tooltip>),
        variant: variant,
    }
};

export default listAction;
