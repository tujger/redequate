import React from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import {Link, matchPath, useHistory, useLocation} from "react-router-dom";
import Button from "../../controls/Button/Button";
import selectStyles from "../../controls/Select/Select.module.css";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/BottomToolbar.module.css";

const MenuLink = ({item, onClose, selected, userData}) => {
    const onPointerDown = useRippleEffect();

    return <Link
        aria-current={selected ? "page" : undefined}
        className={[selectStyles.menuItem, styles.menuItem, selected && styles.selectedItem].filter(Boolean).join(" ")}
        onClick={onClose}
        onClickCapture={item.onClick}
        onPointerDown={onPointerDown}
        role="menuitem"
        to={item.route}
    >
        {item.label}
        {item.adornment && userData && item.adornment(userData)}
    </Link>;
};

const BottomToolbar = ({items, className}) => {
    const [openIndex, setOpenIndex] = React.useState(null);
    const [menuPosition, setMenuPosition] = React.useState(null);
    const triggerRefs = React.useRef([]);
    const menuRef = React.useRef(null);
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const location = useLocation();

    const matchesRoute = path => !!path && !!matchPath(location.pathname, {
        exact: true,
        path,
        strict: true,
    });

    const closeMenu = React.useCallback(() => {
        setOpenIndex(null);
        setMenuPosition(null);
    }, []);

    const openMenu = index => {
        if (openIndex === index) {
            closeMenu();
            return;
        }
        const menu = items[index]?.slice(1) || [];
        if (!menu.some(item => !item.disabled && matchRole(item.roles, currentUserData))) return;
        setMenuPosition(null);
        setOpenIndex(index);
    };

    React.useLayoutEffect(() => {
        if (openIndex === null || !menuRef.current) return undefined;

        const updatePosition = () => {
            const trigger = triggerRefs.current[openIndex];
            const menu = menuRef.current;
            if (!trigger || !menu) return;
            const rect = trigger.getBoundingClientRect();
            const maxHeight = Math.max(0, rect.top - 8);
            const height = Math.min(menu.scrollHeight, maxHeight);
            const left = Math.max(8, Math.min(
                rect.left + (rect.width - menu.offsetWidth) / 2,
                window.innerWidth - menu.offsetWidth - 8
            ));
            const top = Math.max(8, rect.top - height);
            setMenuPosition(position => position?.left === left && position?.top === top && position?.maxHeight === maxHeight
                ? position
                : {left, top, maxHeight});
        };

        updatePosition();
        const frame = window.requestAnimationFrame(() => menuRef.current?.querySelector('[role="menuitem"]')?.focus());
        window.addEventListener("resize", updatePosition);
        document.addEventListener("scroll", updatePosition, true);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("resize", updatePosition);
            document.removeEventListener("scroll", updatePosition, true);
        };
    }, [openIndex]);

    React.useEffect(() => {
        if (openIndex === null) return undefined;

        const handleOutsidePointerDown = event => {
            if (menuRef.current?.contains(event.target) || triggerRefs.current[openIndex]?.contains(event.target)) return;
            closeMenu();
        };
        const handleEscape = event => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            closeMenu();
            triggerRefs.current[openIndex]?.focus();
        };

        document.addEventListener("pointerdown", handleOutsidePointerDown, true);
        document.addEventListener("keydown", handleEscape, true);
        return () => {
            document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
            document.removeEventListener("keydown", handleEscape, true);
        };
    }, [openIndex, closeMenu]);

    React.useEffect(() => closeMenu(), [location.pathname, closeMenu]);

    const openSection = openIndex === null ? null : items[openIndex];
    const openItems = openSection?.slice(1).filter(item => !item.disabled && matchRole(item.roles, currentUserData)) || [];
    const menu = openSection && openItems.length > 0 && <div
        className={[selectStyles.menu, !menuPosition && styles.positionPending].filter(Boolean).join(" ")}
        onKeyDown={event => {
            if (event.key === "Tab") {
                closeMenu();
                return;
            }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const entries = Array.from(menuRef.current.querySelectorAll('[role="menuitem"]'));
            if (!entries.length) return;
            event.preventDefault();
            const index = entries.indexOf(document.activeElement);
            const nextIndex = index < 0
                ? event.key === "ArrowDown" ? 0 : entries.length - 1
                : (index + (event.key === "ArrowDown" ? 1 : entries.length - 1)) % entries.length;
            entries[nextIndex].focus();
        }}
        onMouseLeave={event => {
            if (!triggerRefs.current[openIndex]?.contains(event.relatedTarget)) closeMenu();
        }}
        ref={menuRef}
        role="menu"
        style={menuPosition ? {
            left: menuPosition.left,
            maxHeight: menuPosition.maxHeight,
            top: menuPosition.top,
        } : undefined}
    >
        {openItems.map((item, index) => {
            const selected = matchesRoute(item._route || item.route);
            if (item.component) return <MenuLink
                item={item}
                key={`${item.route || "item"}-${index}`}
                onClose={closeMenu}
                selected={selected}
                userData={currentUserData}
            />;

            return <Button
                aria-current={selected ? "page" : undefined}
                className={[selectStyles.menuItem, styles.menuItem, selected && styles.selectedItem].filter(Boolean).join(" ")}
                color="inherit"
                key={`${item.route || "item"}-${index}`}
                onClick={event => {
                    item.onClick?.(event);
                    closeMenu();
                }}
                role="menuitem"
                variant="text"
            >
                {item.label}
                {item.adornment && currentUserData && item.adornment(currentUserData)}
            </Button>;
        })}
    </div>;

    return <>
        <div aria-hidden="true" className={styles.placeholder}/>
        <nav aria-label={"Bottom navigation"} className={[styles.toolbar, className].filter(Boolean).join(" ")}>
            {items.map((list, index) => {
                const [first] = list;
                if (!first || first.disabled || !matchRole(first.roles, currentUserData)) return null;
                const currentItem = list.find(item => matchesRoute(item._route || item.route)) || first;
                const selected = matchesRoute(currentItem.route);

                return <Button
                    aria-current={selected ? "page" : undefined}
                    aria-expanded={openIndex === index}
                    className={[styles.action].filter(Boolean).join(" ")}
                    // color={"inherit"}
                    color={selected ? "primary" : "secondary"}
                    icon={currentItem.icon}
                    key={`${first.route || "section"}-${index}`}
                    onClick={() => {
                        if (selected) openMenu(index);
                        else {
                            closeMenu();
                            history.push(currentItem.route);
                        }
                    }}
                    onContextMenu={event => {
                        event.preventDefault();
                        openMenu(index);
                    }}
                    ref={element => {
                        triggerRefs.current[index] = element;
                    }}
                    size={"small"}
                    title={typeof currentItem.label === "string" ? currentItem.label : undefined}
                    variant={"text"}
                />
            })}
        </nav>
        {menu && ReactDOM.createPortal(menu, document.body)}
    </>;
};

BottomToolbar.propTypes = {
    className: PropTypes.string,
    items: PropTypes.array.isRequired,
};

export default BottomToolbar;
