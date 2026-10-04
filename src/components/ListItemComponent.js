import React from "react";
import {toDateString} from "../controllers/DateFormat";
import Select from "../controls/Select/Select";
import SelectItem from "../controls/Select/SelectItem";
import useRippleEffect from "../helpers/useRippleEffect";
import ItemPlaceholderComponent from "./ItemPlaceholderComponent";
import ListSwipeableItemComponent from "./ListSwipeableItemComponent";
import styles from "./styles/ListItemComponent.css";

export default (
    {
        avatar = undefined,
        className = undefined,
        menu = undefined,
        title = undefined,
        subtitle = undefined,
        timestamp = undefined,
        children = undefined,
        onClick = undefined,
        pattern,
        skeleton,
        variant = "flat",
        ...props
    }) => {
    const onPointerDown = useRippleEffect();
    const [disabled, setDisabled] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);
    const patternClass = pattern
        ? styles[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`]
        : styles.cardFlat;

    const handleOpen = () => {
        if (disabled) return;
        onClick?.();
    };

    const handleKeyDown = event => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        handleOpen();
    };

    const handleMenuOpen = event => {
        event?.stopPropagation();
        setMenuOpen(true);
    };

    const handleMenuClose = event => {
        event?.stopPropagation();
        setMenuOpen(false);
    };

    if (skeleton) return <ItemPlaceholderComponent classes={styles} pattern={"flat"}/>;

    return <ListSwipeableItemComponent
        {...props}
        className={[
            styles.item,
            // patternClass,
            styles[variant],
            className
        ].filter(Boolean).join(" ")}
        disabled={disabled}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        onPointerDown={onClick ? onPointerDown : undefined}
    >
        {avatar}
        <div className={styles.content}>
            <div className={[styles.header].filter(Boolean).join(" ")}>
                {title && <div className={styles.title}>{title}</div>}
                {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                {timestamp && <span
                    className={styles.timestamp}
                    title={new Date(timestamp).toLocaleString()}
                >{toDateString(timestamp)}</span>}
            </div>
            {children && <div className={styles.children}>{children}</div>}
            {menu?.map && <Select
                className={styles.menuPosition}
                displayEmpty
                iconMenu
                // onChange={onContextMenu}
                onClickCapture={event => {
                    event.stopPropagation();
                }}
                value={""}
            >
                {menu.map((item, index) => <SelectItem
                    children={item.label}
                    key={index}
                    onClickCapture={event => {
                        event.stopPropagation();
                        onMenuSelect?.(event, item);
                    }}
                    // onClick={handleSelectItemClick}
                    value={item.value}
                />)}
            </Select>}
            {menu && !menu.map && <div className={styles.menuPosition}>{menu}</div>}
        </div>
    </ListSwipeableItemComponent>
    // classes, children, leftAction, rightAction, onClickCapture, onContextMenu

};
