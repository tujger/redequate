import React from "react";
import {Link} from "react-router-dom";
import menuStyles from "../../controls/Menu/Menu.module.css";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/BottomToolbar.module.css";

export default ({item, onClose, selected, userData}) => {
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
