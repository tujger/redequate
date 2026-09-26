import MenuItem from "@material-ui/core/MenuItem";
import MaterialSelect from "@material-ui/core/Select";
import React from "react";
import selectStyles from "./Select.module.css";

export default ({children, className, MenuProps: givenMenuProps, options = [], ...props}) => {
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
    };

    return <MaterialSelect
        {...props}
        className={[selectStyles.select, className].filter(Boolean).join(" ")}
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
