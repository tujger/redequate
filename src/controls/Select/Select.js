import MenuItem from "@material-ui/core/MenuItem";
import MaterialSelect from "@material-ui/core/Select";
import React from "react";
import selectStyles from "./Select.module.css";
import Fade from "@material-ui/core/Fade";
import buttonStyles from "../Button/Button.module.css";

export default ({children, className, iconMenu, MenuProps: givenMenuProps, options = [], ...props}) => {
    const menuProps = {
        ...(givenMenuProps || {}),
        MenuListProps: {
            ...((givenMenuProps && givenMenuProps.MenuListProps) || {}),
            className: [
                selectStyles.menuList,
                givenMenuProps && givenMenuProps.MenuListProps && givenMenuProps.MenuListProps.className,
            ].filter(Boolean).join(" "),
        },
        PaperProps: {
            ...((givenMenuProps && givenMenuProps.PaperProps) || {}),
            className: [
                selectStyles.menu,
                givenMenuProps && givenMenuProps.PaperProps && givenMenuProps.PaperProps.className,
            ].filter(Boolean).join(" "),
        },
        TransitionComponent: Fade,
    };

    return <MaterialSelect
        {...props}
        className={[
            selectStyles.select,
            iconMenu && selectStyles.iconMenu,
            iconMenu && buttonStyles.button,
            iconMenu && buttonStyles.iconButton,
            className
        ].filter(Boolean).join(" ")}
        MenuProps={menuProps}
    >
        {children || options.map(option => <MenuItem
            className={selectStyles.menuItem}
            key={option.value}
            value={option.value}
        >
            {option.label}
        </MenuItem>)}
    </MaterialSelect>;
};
