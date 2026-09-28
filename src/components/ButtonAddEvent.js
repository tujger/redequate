import React from "react";
import AddToCalendarHOC from "react-add-to-calendar-hoc";
import Button from "../controls/Button/Button";
import Select from "../controls/Select/Select";
import SelectItem from "../controls/Select/SelectItem";
import styles from "./styles/ButtonAddEvent.module.css";

let anchor;

const Dropdown = ({children, isOpen, onRequestClose}) => <Select
    className={styles.dropdownSelect}
    displayEmpty
    IconComponent={() => null}
    MenuProps={{
        anchorEl: anchor,
        keepMounted: true,
    }}
    onClose={onRequestClose}
    open={isOpen}
    renderValue={() => null}
    value={""}
>
    {React.Children.map(children, (item, index) => <SelectItem
        key={index}
        value={index}
    >
        {item}
    </SelectItem>)}
</Select>;

const CButton = props => {
    const {
        children,
        childrenalt,
        ...otherProps
    } = props;
    return <Button {...otherProps} color={"primary"} variant={"contained"}>{childrenalt || children}</Button>;
};

const ButtonAddEvent = props => {
    const {
        addEvent,
        children,
        className,
        color = "default",
        duration,
        endDatetime,
        event,
        location,
        description,
        startDatetime,
        title,
        variant,
        ...otherProps
    } = props;

    if (!endDatetime || !startDatetime || !description || !title || !location || !duration) {
        return <Button
            className={className}
            color={color}
            disabled
            title={title}
            variant={variant}
        >
            {children}
        </Button>;
    }

    const givenEvent = event || {
        description,
        duration,
        endDatetime: endDatetime && endDatetime.format("YYYYMMDDTHHmmss"),
        location,
        startDatetime: startDatetime && startDatetime.format("YYYYMMDDTHHmmss"),
        title,
    };

    const AddToCalendarDropdown = AddToCalendarHOC(CButton, Dropdown);

    return <AddToCalendarDropdown
        buttonProps={{
            ...otherProps,
            childrenalt: children,
            onClickCapture: event => {
                anchor = event.currentTarget;
            },
            variant: "contained"
        }}
        className={[styles.container, className].filter(Boolean).join(" ")}
        event={givenEvent}
        linkProps={{
            className: styles.label,
            role: "menuitem",
        }}
    />;
};

export default ButtonAddEvent;
