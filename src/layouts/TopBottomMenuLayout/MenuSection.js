import ArrowRightIcon from "@material-ui/icons/ArrowRight";
import React from "react";
import {Link, useHistory} from "react-router-dom";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";
import Button from "../../controls/Button/Button";
import Menu from "../../controls/Menu/Menu";
import menuStyles from "../../controls/Menu/Menu.module.css";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/MenuSection.module.css";

const allowed = (item, userData) => !item.disabled && matchRole(item.roles, userData);

const filterItems = (items, userData) => items.reduce((result, entry) => {
    if (Array.isArray(entry)) {
        if (!entry.length || !allowed(entry[0], userData)) return result;
        const nested = filterItems(entry, userData);
        if (nested.length) result.push(nested);
    } else if (entry && allowed(entry, userData)) result.push(entry);
    return result;
}, []);

const MenuLink = ({item, onClose, userData}) => {
    const onPointerDown = useRippleEffect();

    return <Link
        className={[menuStyles.menuItem, styles.item].join(" ")}
        onClick={event => {
            event.stopPropagation();
            onClose(event);
        }}
        onClickCapture={item.onClick}
        onPointerDown={onPointerDown}
        role="menuitem"
        tabIndex={-1}
        to={item.route}
    >
        {item.label}
        {item.adornment && userData && item.adornment(userData)}
    </Link>;
};

const MenuSelector = ({item, onActivate, onHover, open, userData}) => {
    const onPointerDown = useRippleEffect();

    return <div
        aria-expanded={open}
        aria-haspopup="menu"
        className={[menuStyles.menuItem, styles.item, styles.selector].join(" ")}
        onClick={onActivate}
        onMouseEnter={onHover}
        onPointerDown={onPointerDown}
        role="menuitem"
        tabIndex={-1}
    >
        {item.label}
        {item.adornment && userData && item.adornment(userData)}
        <ArrowRightIcon aria-hidden="true" className={styles.submenuIcon}/>
    </div>;
};

export default ({badge = {}, items, className, endIcon}) => {
    const [first, ...menu] = items;
    const [open, setOpen] = React.useState(false);
    const sectionRef = React.useRef(null);
    const triggerRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const visible = filterItems(menu, currentUserData);
    const hasMenu = visible.length > 1 || (visible.length === 1 && Array.isArray(visible[0]) && visible[0].length > 1);
    const hasBadge = menu.some(item => !Array.isArray(item) && badge[item.route]);

    React.useEffect(() => {
        if (!hasMenu) setOpen(false);
    }, [hasMenu]);

    if (!first || !allowed(first, currentUserData)) return null;

    const closeMenu = () => setOpen(false);
    const renderItem = (item, {selector, open: branchOpen, onActivate, onHover, closeTree}) => {
        if (selector) return <MenuSelector
            item={item}
            onActivate={onActivate}
            onHover={onHover}
            open={branchOpen}
            userData={currentUserData}
        />;
        if (item.component) return <MenuLink
            item={item}
            onClose={closeTree}
            userData={currentUserData}
        />;
        return <Button
            className={[menuStyles.menuItem, styles.item].join(" ")}
            color="inherit"
            onClick={event => {
                item.onClick?.(event);
                if (item.route) history.push(item.route);
                closeTree(event);
            }}
            role="menuitem"
            tabIndex={-1}
            variant="text"
        >
            {item.label}
            {item.adornment && currentUserData && item.adornment(currentUserData)}
        </Button>;
    };

    return <div
        className={[className, styles.section].filter(Boolean).join(" ")}
        onBlur={event => {
            if (!sectionRef.current?.contains(event.relatedTarget)
                && !menuRef.current?.contains(event.relatedTarget)) closeMenu();
        }}
        onMouseEnter={() => hasMenu && window.innerWidth > 599 && setOpen(true)}
        onMouseLeave={event => {
            if (!sectionRef.current?.contains(event.relatedTarget)
                && !menuRef.current?.contains(event.relatedTarget)) closeMenu();
        }}
        ref={sectionRef}
    >
        <Button
            aria-expanded={hasMenu ? open : undefined}
            aria-haspopup={hasMenu ? "menu" : undefined}
            className={styles.trigger}
            color="inherit"
            onClick={event => {
                event.stopPropagation();
                if (hasMenu) {
                    setOpen(current => window.innerWidth <= 599 ? !current : true);
                    // return;
                }
                first.onClick?.(event);
                if (first.route) history.push(first.route);
            }}
            onKeyDown={event => {
                if (hasMenu && ["ArrowDown", "ArrowRight"].includes(event.key)) {
                    event.preventDefault();
                    setOpen(true);
                }
            }}
            onMouseEnter={() => hasMenu && window.innerWidth > 599 && setOpen(true)}
            ref={triggerRef}
            variant="text"
        >
            {first.label}
            {hasBadge && <span className={styles.badge}/>}
            {endIcon && <span className={styles.endIcon}>{endIcon}</span>}
        </Button>
        <Menu
            anchorEl={triggerRef}
            anchorOrigin={{vertical: "bottom", horizontal: "center"}}
            closeOnBlur
            closeOnMouseLeave
            containerRef={menuRef}
            items={visible}
            offset={0}
            onClose={closeMenu}
            open={open && hasMenu}
            renderItem={renderItem}
            transformOrigin={{vertical: "top", horizontal: "center"}}
        />
    </div>;
};
