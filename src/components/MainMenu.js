import React from "react";
import PropTypes from "prop-types";
import Divider from "@material-ui/core/Divider";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import withStyles from "@material-ui/styles/withStyles";
import {Link} from "react-router-dom";
import {matchRole, useCurrentUserData} from "../controllers/UserData";

const styles = theme => ({
    header: {
        ...theme.mixins.toolbar,
        [theme.breakpoints.up("md")]: {
            display: "flex",
            height: 120
        },
        [theme.breakpoints.down("md")]: {
            alignItems: "center",
            justifyContent: "flex-end",
            display: "flex",
        },
    },
    indent: {
        ...theme.mixins.toolbar,
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    active: {
        backgroundColor: "rgba(0,0,0,.1)",
    }
});

function MainMenu(props) {
    const {items, classes, onClick} = props;
    const currentUserData = useCurrentUserData();

    return <div className={"MuiMainMenu-root"}>
        {items.map((list, index) => {
            let hasItems = false;
            let firstDone = false;
            const section = <div className={"MuiMainMenu-section"} key={index}>
                <List>
                    {list.map((item) => {
                        if (item.disabled) return null;
                        if (!matchRole(item.roles, currentUserData)) return null;
                        if (!firstDone) {
                            firstDone = true;
                            return null;
                        }
                        hasItems = true;
                        const activeItem = item.route === location.pathname;
                        return <Link to={item.route}
                                     key={item.route + Math.random()}
                                     className={classes.label}>
                            <ListItem button key={item.id}
                                      className={activeItem ? classes.active : ""}
                                      onClick={onClick}>
                                <ListItemIcon>{item.icon}</ListItemIcon>
                                <ListItemText>
                                    {item.label}
                                    {item.adornment && currentUserData ? item.adornment(currentUserData) : null}
                                </ListItemText>
                            </ListItem>
                        </Link>
                    })}
                </List>
                <Divider/>
            </div>;
            return hasItems ? section : null;
        })}
    </div>
}

MainMenu.propTypes = {
    items: PropTypes.array,
    onClick: PropTypes.func
};

export default withStyles(styles)(MainMenu);
