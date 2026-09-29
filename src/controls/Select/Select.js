import ArrowDropDownIcon from "@material-ui/icons/ArrowDropDown";
import ArrowDropUpIcon from "@material-ui/icons/ArrowDropUp";
import React from "react";
import ReactDOM from "react-dom";
import useRippleEffect from "../../helpers/useRippleEffect";
import buttonStyles from "../Button/Button.module.css";
import styles from "./Select.module.css";
import SelectItem from "./SelectItem";

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
        tabIndex: givenTabIndex = 0,
        value,
        ...otherProps
    }) => {
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const menuId = React.useRef(null);
    if (!menuId.current) menuId.current = `redequate-select-${++nextMenuId}`;

    const [internalOpen, setInternalOpen] = React.useState(false);
    const [position, setPosition] = React.useState({left: 0, top: 0});
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

    const updatePosition = () => {
        const anchor = anchorEl || triggerRef.current;
        if (!anchor || !menuRef.current || typeof window === "undefined") return;

        const rect = anchor.getBoundingClientRect();
        const menu = menuRef.current;
        const width = Math.max(menu.offsetWidth, rect.width);
        const height = menu.offsetHeight;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const below = rect.bottom + 8;
        const above = rect.top - height - 8;
        const top = below + height <= window.innerHeight - 8 || above < 8
            ? Math.max(8, Math.min(below, window.innerHeight - height - 8))
            : above;

        setPosition(current => current.left === left && current.top === top ? current : {left, top});
    };

    React.useLayoutEffect(() => {
        if (!open) return undefined;
        updatePosition();

        const items = menuRef.current && menuRef.current.querySelectorAll("[data-select-option]");
        const selected = Array.from(items || []).find(item => item.getAttribute("data-selected") === "true");
        (selected || items && items[0])?.focus();

        window.addEventListener("resize", updatePosition);
        document.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            document.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, anchorEl]);

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

    const handleMenuKeyDown = event => {
        if (event.key === "Escape") {
            event.preventDefault();
            requestClose(event);
            (anchorEl || triggerRef.current)?.focus();
            return;
        }
        if (event.key === "Tab") {
            requestClose(event);
            return;
        }

        const items = Array.from(menuRef.current.querySelectorAll("[data-select-option]"));
        const index = items.indexOf(document.activeElement);
        let nextIndex;
        if (event.key === "ArrowDown") nextIndex = (index + 1) % items.length;
        else if (event.key === "ArrowUp") nextIndex = (index - 1 + items.length) % items.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = items.length - 1;
        else if ((event.key === "Enter" || event.key === " ") && index >= 0) {
            event.preventDefault();
            items[index].click();
            return;
        } else return;

        if (!items.length) return;
        event.preventDefault();
        items[nextIndex].focus();
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
        : options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>);
    const menuItems = items.map(item => {
        if (!React.isValidElement(item)) return item;
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
    const selectedItem = items.find(item => React.isValidElement(item) && item.props.value === value);
    const display = renderValue
        ? renderValue(value)
        : value === "" && !displayEmpty
            ? null
            : selectedItem?.props.children;
    const menu = open && typeof document !== "undefined" && ReactDOM.createPortal(<>
        <div
            aria-hidden={"true"}
            className={styles.backdrop}
            data-testid={"select-backdrop"}
            onClick={event => {
                event.stopPropagation();
                requestClose(event);
            }}
        />
        <div
            className={styles.menu}
            id={menuId.current}
            onClick={event => event.stopPropagation()}
            onKeyDown={handleMenuKeyDown}
            onPointerDown={event => event.stopPropagation()}
            ref={menuRef}
            role={iconMenu ? "menu" : "listbox"}
            style={{
                left: position.left,
                minWidth: (anchorEl || triggerRef.current)?.getBoundingClientRect().width,
                top: position.top
            }}
        >
            {menuItems}
        </div>
    </>, document.body);

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
                color === "secondary" && styles.secondary,
                color === "primary" && styles.primary,
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
                : <ArrowDropDownIcon aria-hidden={"true"} className={styles.arrow} data-testid={"select-arrow-down"}/>
            )}
        </div>
        {menu}
    </>;
};
