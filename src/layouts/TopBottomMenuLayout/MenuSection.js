import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import React from "react";
import ReactDOM from "react-dom";
import {Link, useHistory} from "react-router-dom";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";
import Button from "../../controls/Button/Button";
import selectStyles from "../../controls/Select/Select.module.css";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/MenuSection.module.css";

const MenuLink = ({item, onClose, userData}) => {
    const onPointerDown = useRippleEffect();

    return <Link
        className={[selectStyles.menuItem, styles.item].join(" ")}
        onClick={event => {
            event.stopPropagation();
            onClose();
        }}
        onClickCapture={item.onClick}
        onPointerDown={onPointerDown}
        role={"menuitem"}
        to={item.route}
    >
        {item.label}
        {item.adornment && userData && item.adornment(userData)}
    </Link>;
};

const MenuSection = ({badge = {}, items, className, endIcon, nested = false, onCloseTree}) => {
    const [first, ...menu] = items;
    const [open, setOpen] = React.useState(false);
    const [openLeft, setOpenLeft] = React.useState(false);
    const [menuPosition, setMenuPosition] = React.useState(null);
    const sectionRef = React.useRef(null);
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const currentUserData = useCurrentUserData();
    const history = useHistory();

    const allowedItems = menu.filter(item => Array.isArray(item)
        ? item[0] && matchRole(item[0].roles, currentUserData)
        : !item.disabled && matchRole(item.roles, currentUserData));
    const hasMenu = allowedItems.length > 0;
    const hasBadge = menu.some(item => !Array.isArray(item) && badge[item.route]);
    const containsTarget = React.useCallback(target => target?.nodeType && (
        sectionRef.current?.contains(target) || menuRef.current?.contains(target)
    ), []);

    const updateMenuPosition = React.useCallback(() => {
        if (!triggerRef.current || !menuRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const width = menuRef.current.offsetWidth;
        const height = menuRef.current.offsetHeight;
        const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
        const above = rect.top - height;
        const below = rect.bottom;
        const top = below + height <= window.innerHeight - 8 || above < 8
            ? Math.max(8, Math.min(below, window.innerHeight - height - 8))
            : above;
        setMenuPosition(current => current?.left === left && current?.top === top ? current : {left, top});
    }, []);

    React.useEffect(() => {
        if (!open) return undefined;
        const handleOutsidePointerDown = event => {
            if (!containsTarget(event.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", handleOutsidePointerDown, true);
        return () => document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }, [open, containsTarget]);

    React.useLayoutEffect(() => {
        if (!open || nested) return undefined;
        updateMenuPosition();
        window.addEventListener("resize", updateMenuPosition);
        document.addEventListener("scroll", updateMenuPosition, true);
        return () => {
            window.removeEventListener("resize", updateMenuPosition);
            document.removeEventListener("scroll", updateMenuPosition, true);
        };
    }, [open, nested, updateMenuPosition]);

    React.useLayoutEffect(() => {
        if (!open || !nested || !triggerRef.current || !menuRef.current) return;
        const right = triggerRef.current.getBoundingClientRect().right;
        setOpenLeft(right + menuRef.current.offsetWidth > window.innerWidth - 8);
    }, [open, nested]);

    if (!first || !matchRole(first.roles, currentUserData)) return null;

    const closeTree = () => {
        setOpen(false);
        onCloseTree?.();
    };

    const focusFirstItem = () => {
        requestAnimationFrame(() => menuRef.current?.querySelector('[role="menuitem"]')?.focus());
    };

    const handleTriggerKeyDown = event => {
        if (!hasMenu || event.key !== (nested ? "ArrowRight" : "ArrowDown")) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
        focusFirstItem();
    };

    const handleKeyDown = event => {
        if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
            return;
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        const currentMenu = event.target.closest('[role="menu"]');
        if (!currentMenu || !containsTarget(currentMenu)) return;
        const entries = Array.from(currentMenu.querySelectorAll('[role="menuitem"]'))
            .filter(entry => entry.closest('[role="menu"]') === currentMenu);
        if (!entries.length) return;
        event.preventDefault();
        event.stopPropagation();
        const index = entries.indexOf(event.target);
        entries[(index + (event.key === "ArrowDown" ? 1 : entries.length - 1)) % entries.length].focus();
    };

    const dropdown = open && hasMenu && <div
        className={[styles.menu, !nested && styles.portalMenu, !nested && !menuPosition && styles.positionPending, openLeft && styles.openLeft].filter(Boolean).join(" ")}
        onBlur={event => {
            if (!containsTarget(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={handleKeyDown}
        onMouseLeave={event => {
            if (!containsTarget(event.relatedTarget)) setOpen(false);
        }}
        ref={menuRef}
        role="menu"
        style={!nested ? {
            "--menu-left": `${menuPosition?.left ?? 0}px`,
            "--menu-top": `${menuPosition?.top ?? 0}px`,
        } : undefined}
    >
        {menu.map((item, index) => {
            if (Array.isArray(item)) {
                return <MenuSection
                    className={[selectStyles.menuItem, styles.item].join(" ")}
                    badge={{}}
                    endIcon={<ArrowRightIcon/>}
                    items={item}
                    key={index}
                    nested
                    onCloseTree={closeTree}
                />;
            }
            if (item.disabled || !matchRole(item.roles, currentUserData)) return null;
            if (item.component) {
                return <MenuLink
                    item={item}
                    key={index}
                    onClose={closeTree}
                    userData={currentUserData}
                />;
            }
            return <Button
                className={[selectStyles.menuItem, styles.item].join(" ")}
                color={"inherit"}
                key={index}
                onClick={event => {
                    item.onClick?.(event);
                    closeTree();
                }}
                role={"menuitem"}
                variant={"text"}
            >
                {item.label}
                {item.adornment && currentUserData && item.adornment(currentUserData)}
            </Button>;
        })}
    </div>;

    const SectionButton = nested ? "div" : Button;

    return <div
        className={[className, styles.section, nested && styles.nestedSection].filter(Boolean).join(" ")}
        onBlur={event => {
            if (!containsTarget(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => hasMenu && setOpen(true)}
        onMouseLeave={event => {
            if (!containsTarget(event.relatedTarget)) setOpen(false);
        }}
        ref={sectionRef}
    >
        <SectionButton
            aria-expanded={hasMenu ? open : undefined}
            aria-haspopup={hasMenu ? "menu" : undefined}
            className={[styles.trigger, nested && styles.nestedTrigger].filter(Boolean).join(" ")}
            color={"inherit"}
            onClick={event => {
                event.stopPropagation();
                history.push(first.route);
                closeTree();
            }}
            onKeyDown={handleTriggerKeyDown}
            ref={triggerRef}
            role={nested ? "menuitem" : "button"}
            variant={"text"}
        >
            {first.label}
            {hasBadge && <span className={styles.badge}/>}
            {endIcon && <span className={styles.endIcon}>{endIcon}</span>}
        </SectionButton>
        {nested || typeof document === "undefined" ? dropdown : dropdown && ReactDOM.createPortal(dropdown, document.body)}
    </div>;
};

export default MenuSection;
