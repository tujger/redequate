import React from "react";
import PropTypes from "prop-types";
import MenuItem from "@material-ui/core/MenuItem";
import withStyles from "@material-ui/styles/withStyles";
import {matchRole, useCurrentUserData} from "../controllers/UserData";
import {Link} from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import MenuList from "@material-ui/core/MenuList";
import Typography from "@material-ui/core/Typography";

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

const MenuSection = withStyles(styles)(props => {
    const {items, classes} = props;
    const [first, ...menu] = items;
    const currentUserData = useCurrentUserData();

    if (!matchRole(first.roles, currentUserData)) return null;

    return <Grid className={classes.menusection}>
        <Typography>
            {first.label}
        </Typography>
        <MenuList>
            {menu.map((item, index) => {
                if (!matchRole(item.roles, currentUserData) || item.disabled) return null;
                return <Link to={item.route}
                             key={index}
                             className={classes.label}>
                    <MenuItem button key={item.id}
                              className={classes.menuitem}>
                        {item.label}
                    </MenuItem>
                </Link>
            })}
        </MenuList>
    </Grid>
});


const TopMenu = withStyles(styles)(props => {
    const {items, classes, className} = props;
    return <Grid container className={["MuiBottomMenu-root", classes.bottommenu, className].join(" ")}
                 justify={"center"}>
        {items.map((list, index) => <MenuSection key={index} items={list}/>)}
    </Grid>
});

TopMenu.propTypes = {
    children: PropTypes.array,
};

export default TopMenu;
