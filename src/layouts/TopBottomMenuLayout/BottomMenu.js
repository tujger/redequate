import React from "react";
import MenuItem from "@material-ui/core/MenuItem";
import withStyles from "@material-ui/styles/withStyles";
import {Link} from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import MenuList from "@material-ui/core/MenuList";
import Typography from "@material-ui/core/Typography";
import {matchRole, useCurrentUserData} from "../../controllers/UserData";

const styles = theme => ({
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    bottommenu: {
        backgroundColor: theme.palette.background.default,
        borderTopWidth: 1,
        borderTopStyle: "solid",
        borderTopColor: theme.palette.grey[500],
        color: theme.palette.getContrastText(theme.palette.background.default),
    },
    menusection: {
        paddingRight: theme.spacing(2),
    },
    menuitem: {
        fontSize: "small",
        lineHeight: "initial",
        padding: theme.spacing(0.5),
    }
});

const MenuSection = props => {
    const {items, classes} = props;
    const [first, ...menu] = items;
    const currentUserData = useCurrentUserData();

    if (!matchRole(first.roles, currentUserData)) return null;

    return <Grid className={classes.menusection}>
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
                className={[classes.label, classes.menuitem].join(" ")}
                key={index}
                /* eslint-disable-next-line react/jsx-handler-names */
                onClickCapture={item.onClick}
            />;
            if (item.component) {
                return <Link
                    children={child}
                    className={classes.label}
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
