import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Button from "@material-ui/core/Button";

const stylesCurrent = theme => ({
    action: {
        borderColor: theme.palette.secondary.main,
        // fontSize: theme.typography.caption.fontSize,
        fontWeight: "initial",
        textTransform: "initial",
        [theme.breakpoints.up("md")]: {
            marginBottom: theme.spacing(1),
            marginTop: theme.spacing(1),
        },
        [theme.breakpoints.down("sm")]: {
            marginLeft: theme.spacing(0.5),
            marginRight: theme.spacing(0.5),
            marginTop: theme.spacing(1),
        },
    },
    actionContained: {
        [theme.breakpoints.down("sm")]: {
            minWidth: theme.spacing(25),
            width: "50%",
        },
    }
});

const ActionComponent = ({classes, className = "", disabled, label, onClick, variant = "contained"}) => {
    return <Button
        children={label}
        className={[
            classes.action,
            variant === "contained" ? classes.actionContained : "",
            className
        ].join(" ")}
        color={"secondary"}
        component={"div"}
        disabled={disabled}
        onClick={onClick}
        variant={variant}
        size={"small"}
    />
}

export default withStyles(stylesCurrent)(ActionComponent);
