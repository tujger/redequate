import React from "react";
import {MenuItem} from "@mui/material";
import {withStyles} from "@mui/styles";
import {Link} from "react-router-dom";
import {Grid} from "@mui/material";
import {MenuList} from "@mui/material";
import {Typography} from "@mui/material";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";
import stylesTopBottomMenu from "./styles/TopBottomMenuLayout.module.css";

const styles = theme => ({
    bottommenu: {
        backgroundColor: theme.palette.background.default,
        borderTopWidth: 1,
        borderTopStyle: "solid",
        borderTopColor: theme.palette.grey[500],
        color: theme.palette.getContrastText(theme.palette.background.default),
    },
});

const MenuSection = props => {
    const {items, classes} = props;
    const [first, ...menu] = items;
    const currentUserData = useCurrentUserData();

    if (!matchRole(first.roles, currentUserData)) return null;

    return <Grid className={[classes.menusection, stylesTopBottomMenu.menusection].join(" ")}>
        <Typography>
            {first.label}
        </Typography>
        <MenuList>{menu.map((item, index) => {
            if (!matchRole(item.roles, currentUserData) || item.disabled) return null;
            if (item instanceof Array) {
                console.error("BottomMenu doesn't support hierarchy yet")
                return;
            }
            const child = <MenuItem
                button
                children={item.label}
                className={[stylesTopBottomMenu.label, classes.menuitem, stylesTopBottomMenu.menuitem].join(" ")}
                key={index}
                /* eslint-disable-next-line react/jsx-handler-names */
                onClickCapture={item.onClick}
            />;
            if (item.component) {
                return <Link
                    children={child}
                    className={[stylesTopBottomMenu.label].join(" ")}
                    key={index}
                    to={item.route}
                />
            } else {
                return child
            }
        })}</MenuList>
    </Grid>
};

const TopMenu = ({items, classes, className}) => {
    return <Grid
        className={["MuiBottomMenu-root", classes.bottommenu, className].join(" ")}
        container
        justify={"center"}
    >
        {items.map((list, index) => <MenuSection key={index} classes={classes} items={list}/>)}
    </Grid>
};

export default withStyles(styles)(TopMenu);
