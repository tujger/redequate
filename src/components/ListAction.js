import React from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import Button from "../controls/Button/Button";
import styles from "./styles/ListAction.module.css";

const getContrastText = color => {
    let channels;
    const hex = typeof color === "string" && color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    const rgb = typeof color === "string" && color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i);

    if (hex) {
        const value = hex[1].length === 3 ? [...hex[1]].map(digit => digit + digit).join("") : hex[1];
        channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
    } else if (rgb) {
        channels = rgb.slice(1, 4).map(Number);
    } else {
        return "rgba(0, 0, 0, 0.87)";
    }

    const values = channels.map(value => value / 255).map(value =>
        value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
    );
    const luminance = 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    return (luminance + 0.05) / 0.05 >= 3 ? "rgba(0, 0, 0, 0.87)" : "#fff";
};

const listAction = props => {
    const {action, itemButton, toolbarButton, variant} = props;

    const {label: itemButtonLabel, icon: itemButtonIcon = <DeleteIcon/>, color = "#00ff00"} = itemButton;
    const {label: toolbarButtonLabel, icon: toolbarButtonIcon = <DeleteIcon/>, ask} = toolbarButton;

    const contrastText = getContrastText(color);

    return {
        action,
        ask,
        askTitle: toolbarButtonLabel,
        itemButton: itemProps => <div
            className={[styles.itemAction, itemProps.className].filter(Boolean).join(" ")}
            style={{...itemProps.style, "--list-action-color": color, "--list-action-contrast": contrastText}}
        >
            <span className={[styles.itemIcon, itemProps.selected && styles.selected].filter(Boolean).join(" ")}>
                {itemButtonIcon}
            </span>
            <span className={[styles.label, itemProps.selected && styles.selected].filter(Boolean).join(" ")}>
                {itemButtonLabel}
            </span>
        </div>,
        toolbarButton: <Button icon={toolbarButtonIcon} size={"medium"} title={toolbarButtonLabel}/>,
        variant,
    }
};

export default listAction;
