import React from "react";
import {Link, matchPath, useHistory, useLocation} from "react-router-dom";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";
import Button from "../../controls/Button/Button";
import Menu from "../../controls/Menu/Menu";
import menuStyles from "../../controls/Menu/Menu.module.css";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/BottomToolbar.module.css";

const MenuLink = ({item, onClose, selected, userData}) => {
    const onPointerDown = useRippleEffect();

    return <Link
        aria-current={selected ? "page" : undefined}
        className={[menuStyles.menuItem, styles.menuItem, selected && styles.selectedItem].filter(Boolean).join(" ")}
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

export default ({items, className}) => {
    const [openIndex, setOpenIndex] = React.useState(null);
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
    }, []);

    const openMenu = index => {
        if (openIndex === index) {
            closeMenu();
            return;
        }
        const menu = items[index]?.slice(1) || [];
        if (!menu.some(item => !item.disabled && matchRole(item.roles, currentUserData))) return;
        setOpenIndex(index);
    };

    React.useEffect(() => {
        if (openIndex === null) return undefined;

        const handleEscape = event => {
            if (event.key !== "Escape" || menuRef.current?.contains(event.target)) return;
            event.preventDefault();
            closeMenu();
            triggerRefs.current[openIndex]?.focus();
        };

        document.addEventListener("keydown", handleEscape, true);
        return () => document.removeEventListener("keydown", handleEscape, true);
    }, [openIndex, closeMenu]);

    React.useEffect(() => closeMenu(), [location.pathname, closeMenu]);

    const openSection = openIndex === null ? null : items[openIndex];
    const openItems = openSection?.slice(1).filter(item => !item.disabled && matchRole(item.roles, currentUserData)) || [];
    const renderItem = item => {
        const selected = matchesRoute(item._route || item.route);
        if (item.component) return <MenuLink
            item={item}
            onClose={closeMenu}
            selected={selected}
            userData={currentUserData}
        />;

        return <Button
            aria-current={selected ? "page" : undefined}
            className={[menuStyles.menuItem, styles.menuItem, selected && styles.selectedItem].filter(Boolean).join(" ")}
            color="inherit"
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
    };

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
        <Menu
            anchorEl={openIndex === null ? null : triggerRefs.current[openIndex]}
            anchorOrigin={{vertical: "top", horizontal: "center"}}
            closeOnMouseLeave
            containerRef={menuRef}
            items={openItems}
            offset={0}
            onClose={closeMenu}
            open={Boolean(openSection && openItems.length)}
            renderItem={renderItem}
            transformOrigin={{vertical: "bottom", horizontal: "center"}}
        />
    </>;
};
