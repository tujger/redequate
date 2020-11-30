import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Button from "@material-ui/core/Button";

const stylesCurrent = theme => ({
    follow: {
        borderColor: theme.palette.secondary.main,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: "initial",
        textTransform: "initial",
    }
});

const ActionComponent = ({classes, className = "", disabled, label, onClick}) => {
    return <Button
        children={label}
        className={[classes.follow, className].join(" ")}
        color={"secondary"}
        component={"div"}
        disabled={disabled}
        onClick={onClick}
        variant={"outlined"}
        size={"small"}
    />
}

export default withStyles(stylesCurrent)(ActionComponent);
