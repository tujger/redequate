import React from "react";
import {toDateString} from "../controllers/DateFormat";
import Select from "../controls/Select/Select";
import SelectItem from "../controls/Select/SelectItem";
import useRippleEffect from "../helpers/useRippleEffect";
import ItemPlaceholderComponent from "./ItemPlaceholderComponent";
import ListSwipeableItemComponent from "./ListSwipeableItemComponent";
import styles from "./styles/ListItemComponent.module.css";

export default (
    {
        avatar = undefined,
        avatarInTitle = false,
        className = undefined,
        disableClick = false,
        header = undefined,
        footer = undefined,
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

    const handleOpen = (event) => {
        if (disabled) return;
        if (disableClick) return;
        onClick?.(event);
    };

    const handleKeyDown = event => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        handleOpen(event);
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
            disableClick ? undefined : styles.clickable,
            styles[variant],
            className
        ].filter(Boolean).join(" ")}
        disabled={disabled}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        onPointerDown={(onClick && !disabled && !disableClick) ? onPointerDown : undefined}
    >
        {header && <div className={styles.header}>
            {header}
        </div>}
        <div className={styles.content}>
            {variant !== "vertical" && avatar}
            <div className={styles.body}>
                {variant === "vertical" && <div className={styles.avatar}>
                    {avatar}
                </div>}
                <div className={[styles.titles].filter(Boolean).join(" ")}>
                    {title && <div className={styles.title}>{title}</div>}
                    {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
                    {timestamp && <span
                        className={styles.timestamp}
                        title={new Date(timestamp).toLocaleString()}
                    >{toDateString(timestamp)}</span>}
                </div>
                {children && <div className={styles.children}>{children}</div>}
            </div>
        </div>
        {footer && <div className={styles.footer}>
            {footer}
        </div>}
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
    </ListSwipeableItemComponent>
    // classes, children, leftAction, rightAction, onClickCapture, onContextMenu

};
