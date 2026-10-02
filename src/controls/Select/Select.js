import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowDropUpIcon from "@material-ui/icons/ArrowDropUp";
import React from "react";
import useRippleEffect from "../../helpers/useRippleEffect";
import buttonStyles from "../Button/Button.module.css";
import Menu from "../Menu/Menu";
import styles from "./Select.module.css";
import SelectDivider from "./SelectDivider";
import SelectItem from "./SelectItem";
import MenuIcon from "@material-ui/icons/MoreVert";

let nextMenuId = 0;

export default (
    {
        anchorEl,
        children,
        className,
        color = "default",
        disabled = false,
        displayEmpty = false,
        fullWidth = false,
        iconMenu = false,
        inputProps = {},
        onChange,
        onClick: givenOnClick,
        onClose,
        onKeyDown: givenOnKeyDown,
        onMouseDown,
        onOpen,
        onPointerDown: givenOnPointerDown,
        open: givenOpen,
        options = [],
        renderValue,
        size = undefined,
        tabIndex: givenTabIndex = 0,
        value,
        ...otherProps
    }) => {
    const triggerRef = React.useRef(null);
    const menuId = React.useRef(null);
    if (!menuId.current) menuId.current = `redequate-select-${++nextMenuId}`;

    const [internalOpen, setInternalOpen] = React.useState(false);
    const controlled = givenOpen !== undefined;
    const open = controlled ? givenOpen : internalOpen;
    const onPointerDown = useRippleEffect(givenOnPointerDown);

    const requestOpen = event => {
        if (disabled || open) return;
        if (!controlled) setInternalOpen(true);
        onOpen && onOpen(event);
    };

    const requestClose = event => {
        if (!open) return;
        if (!controlled) setInternalOpen(false);
        onClose && onClose(event);
    };

    const handleTriggerClick = event => {
        givenOnClick && givenOnClick(event);
        if (event.defaultPrevented) return;
        if (open) requestClose(event);
        else requestOpen(event);
    };

    const handleTriggerKeyDown = event => {
        givenOnKeyDown && givenOnKeyDown(event);
        if (event.defaultPrevented || disabled) return;
        if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            requestOpen(event);
        } else if (event.key === "Escape") {
            requestClose(event);
        }
    };

    const handleSelect = (event, itemValue, item) => {
        onChange && onChange({
            target: {name: inputProps.name, value: itemValue},
            currentTarget: event.currentTarget,
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation(),
        }, item);
        requestClose(event);
    };

    const items = children
        ? React.Children.toArray(children)
        : options.map((option, index) => option === "-"
            ? <SelectDivider key={`divider-${index}`}/>
            : <SelectItem id={option.id} key={option.value} value={option.value}>{option.label}</SelectItem>);
    const menuItems = items.map(item => {
        if (!React.isValidElement(item)) return item;
        if (item.type === SelectDivider) return item;
        const selected = item.props.value === value;
        return React.cloneElement(item, {
            "aria-selected": iconMenu ? undefined : selected,
            "data-select-option": true,
            "data-selected": selected,
            onClickCapture: item.props.onClickCapture ? event => {
                item.props.onClickCapture(event);
                if (event.isPropagationStopped() && !event.defaultPrevented) {
                    handleSelect(event, item.props.value, item);
                }
            } : undefined,
            onClick: event => {
                item.props.onClick && item.props.onClick(event);
                if (!event.defaultPrevented) handleSelect(event, item.props.value, item);
            },
            role: iconMenu ? "menuitem" : "option",
            tabIndex: -1,
        });
    });
    const selectedItem = items.find(item => React.isValidElement(item)
        && item.type !== SelectDivider && item.props.value === value);
    const display = renderValue
        ? renderValue(value)
        : iconMenu
            ? <MenuIcon/>
            : value === "" && !displayEmpty
                ? null
                : selectedItem?.props.children;
    const menu = <Menu
        anchorEl={anchorEl || triggerRef}
        backdrop
        id={menuId.current}
        minWidth
        onClose={requestClose}
        open={open}
        role={iconMenu ? "menu" : "listbox"}
    >
        {menuItems}
    </Menu>;

    return <>
        <div
            {...otherProps}
            {...inputProps}
            aria-controls={open ? menuId.current : undefined}
            aria-disabled={disabled || undefined}
            aria-expanded={Boolean(open)}
            aria-haspopup={iconMenu ? "menu" : "listbox"}
            className={[
                styles.select,
                iconMenu && styles.iconMenu,
                fullWidth && styles.fullWidth,
                iconMenu && buttonStyles.button,
                iconMenu && buttonStyles.iconButton,
                className,
                color === "inherit" && styles.inherit,
                color === "primary" && styles.primary,
                color === "secondary" && styles.secondary,
                size === "small" && styles.small,
                size === "large" && styles.large,
            ].filter(Boolean).join(" ")}
            onClick={disabled ? undefined : handleTriggerClick}
            onKeyDown={handleTriggerKeyDown}
            onMouseDown={onMouseDown}
            onPointerDown={disabled ? undefined : onPointerDown}
            ref={triggerRef}
            role={iconMenu ? "button" : "combobox"}
            tabIndex={disabled ? -1 : givenTabIndex}
        >
            <span className={styles.value}>{display}</span>
            {!iconMenu && (open
                    ? <ArrowDropUpIcon aria-hidden={"true"} className={styles.arrow} data-testid={"select-arrow-up"}/>
                    :
                    <ArrowDropDownIcon aria-hidden={"true"} className={styles.arrow} data-testid={"select-arrow-down"}/>
            )}
        </div>
        {menu}
    </>;
};
