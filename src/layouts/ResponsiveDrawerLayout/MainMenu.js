import React from "react";
import {Link} from "react-router-dom";
import LanguageComponent from "../../components/LanguageComponent";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";
import Button from "../../controls/Button/Button";
import Menu from "../../controls/Menu/Menu";
import menuStyles from "../../controls/Menu/Menu.module.css";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/MainMenu.module.css";

const allowed = (item, userData) => item && !item.disabled && matchRole(item.roles, userData);
const sectionDivider = {};

const filterItems = (items, userData) => items.reduce((result, entry) => {
    if (Array.isArray(entry)) {
        if (!entry.length || !allowed(entry[0], userData)) return result;
        const nested = filterItems(entry, userData);
        if (nested.length) result.push(nested);
    } else if (allowed(entry, userData)) result.push(entry);
    return result;
}, []);

const ItemContent = ({item, userData}) => <>
    <span className={styles.icon}>{item.icon}</span>
    <span className={styles.label}>
        {item.label}
        {item.adornment && userData ? item.adornment(userData) : null}
    </span>
</>;

const MenuLink = ({item, onClick, selected, userData}) => {
    const onPointerDown = useRippleEffect();

    return <Link
        aria-current={selected ? "page" : undefined}
        className={[menuStyles.menuItem, styles.item, selected && styles.active].filter(Boolean).join(" ")}
        onClick={onClick}
        onClickCapture={item.onClick}
        onPointerDown={onPointerDown}
        role="menuitem"
        tabIndex={0}
        to={item.route}
    >
        <ItemContent item={item} userData={userData}/>
    </Link>;
};

export default ({items, onClick}) => {
    const currentUserData = useCurrentUserData();
    const menuItems = items.reduce((result, list) => {
        const visible = filterItems(list, currentUserData);
        if (visible.length > 1 && !Array.isArray(visible[0]) && !Array.isArray(visible[1])
            && visible[0].route && visible[0].route === visible[1].route) visible.shift();
        if (visible.length) result.push(...visible, sectionDivider);
        return result;
    }, []);

    const renderItem = item => {
        if (item === sectionDivider) return <div className={styles.section} role="separator"/>;
        const selected = Boolean(item.route) && item.route === window.location.pathname;
        if (item.component) return <MenuLink
            item={item}
            onClick={onClick}
            selected={selected}
            userData={currentUserData}
        />;

        return <Button
            aria-current={selected ? "page" : undefined}
            className={[menuStyles.menuItem, styles.item, selected && styles.active].filter(Boolean).join(" ")}
            color="inherit"
            onClick={onClick}
            onClickCapture={item.onClick}
            role="menuitem"
            tabIndex={0}
            variant="text"
        >
            <ItemContent item={item} userData={currentUserData}/>
        </Button>;
    };

    return <div className={["MuiMainMenu-root", styles.root].join(" ")}>
        <Menu inline items={menuItems} renderItem={renderItem}/>
        <div className={styles.languageRow}>
            <LanguageComponent fullWidth/>
        </div>
    </div>;
}
