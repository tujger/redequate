import React from "react";
import {Link} from "react-router-dom";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";
import Button from "../../controls/Button/Button";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/BottomMenu.module.css";

const MenuLink = ({item}) => {
    const onPointerDown = useRippleEffect();

    return <Link
        className={styles.item}
        onClickCapture={item.onClick}
        onPointerDown={onPointerDown}
        to={item.route}
    >
        {item.label}
    </Link>;
};

const MenuSection = ({items}) => {
    const [first, ...menu] = items;
    const currentUserData = useCurrentUserData();

    if (!first || first.disabled || !matchRole(first.roles, currentUserData)) return null;

    return <div className={styles.section}>
        <div className={styles.heading}>{first.label}</div>
        <div className={styles.list}>
            {menu.map((item, index) => {
                if (Array.isArray(item)) {
                    return <MenuSection items={item} key={index}/>;
                }
                if (!item || !matchRole(item.roles, currentUserData) || item.disabled) return null;

                if (item.component) return <MenuLink item={item} key={index}/>;

                return <Button
                    className={styles.item}
                    color={"inherit"}
                    key={index}
                    onClick={item.onClick}
                    variant={"text"}
                >
                    {item.label}
                </Button>;
            })}
        </div>
    </div>;
};

export default ({items, className}) => <nav className={[styles.root, className].filter(Boolean).join(" ")}>
    {items.map((list, index) => <MenuSection items={list} key={index}/>)}
</nav>;
