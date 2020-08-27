import React from "react";
import Button from "@material-ui/core/Button";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import withStyles from "@material-ui/styles/withStyles";
import AddToCalendarHOC from "react-add-to-calendar-hoc";

const styles = theme => ({
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    "default": {
        backgroundColor: theme.palette.grey[300],
        color: theme.palette.getContrastText(theme.palette.grey[300]),
        display: "flex",
        padding: 0,
    },
    primary: {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        display: "flex",
        padding: 0,
        "&:hover": {
            backgroundColor: theme.palette.primary.dark,
            color: theme.palette.primary.contrastText,
        }
    },
    secondary: {
        backgroundColor: theme.palette.secondary.main,
        color: theme.palette.secondary.contrastText,
        display: "flex",
        padding: 0,
        "&:hover": {
            backgroundColor: theme.palette.secondary.dark,
            color: theme.palette.secondary.contrastText,
        }
    },
    button: {
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
    }
});

let anchor;

// eslint-disable-next-line react/prop-types
const Dropdown = ({children, classes, isOpen, onRequestClose}) => {
    return <Menu open={isOpen} anchorEl={anchor} onClose={onRequestClose}>
        {children.map((item, index) => {
            return <MenuItem key={index} className={classes.label}>
                {item}
            </MenuItem>
        })}
    </Menu>
};

const CButton = (props) => {
    // eslint-disable-next-line react/prop-types
    const {children, childrenalt, ...otherprops} = props;
    return <Button {...otherprops} children={childrenalt || children}/>
};

const ButtonAddEvent = props => {
    const {
        classes, addEvent, className, color = "default", variant, children,
        event, title, startDatetime, endDatetime, duration, description, location, ...otherProps
    } = props;

    if (!endDatetime || !startDatetime || !description || !title || !location || !duration) {
        return <Button
            // classes={classes}
            className={className}
            color={color}
            variant={variant}
            children={children}
            title={title}
            disabled
        />
    }

    const givenEvent = event || {
        description: description,
        duration: duration,
        endDatetime: endDatetime && endDatetime.format("YYYYMMDDTHHmmss"),
        location: location,
        startDatetime: startDatetime && startDatetime.format("YYYYMMDDTHHmmss"),
        title: title,
    };

    const AddToCalendarDropdown = AddToCalendarHOC(CButton, withStyles(styles)(Dropdown));
    return <AddToCalendarDropdown
        event={givenEvent}
        buttonProps={{
            ...otherProps,
            childrenalt: children,
            className: [classes.label, classes.button].join(" "),
            variant: "text",
            onClickCapture: ev => {
                anchor = ev.currentTarget;
            },
        }}
        color={"primary"}
        linkProps={{
            className: classes.label,
        }}
        className={["MuiButtonBase-root", "MuiButton-root", "MuiButton-contained", props.className, classes[color]].join(" ")}
    />
};

export default withStyles(styles)(ButtonAddEvent);
