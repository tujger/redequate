import React from "react";
import PropTypes from "prop-types";
import {Divider, List, ListItem, ListItemIcon, ListItemText, withStyles} from "@material-ui/core";
import {Link} from "react-router-dom";
import {matchRole, user} from "../controllers/User";

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
    }
});

function MainMenu(props) {
    const {items, classes, onClick} = props;

    return <div className={"MuiMainMenu-root"}>
        {items.map((list) => {
            let hasItems = false;
            let firstDone = false;
            const section = <div className={"MuiMainMenu-section"} key={Math.random()}>
                <List>
                    {list.map((item) => {
                        if (!matchRole(item.roles, user.currentUser())) return null;
                        hasItems = true;
                        if(!firstDone) {
                            firstDone = true;
                            return null;
                        }
                        return <Link to={item.route}
                                     key={item.route + Math.random()}
                                     className={classes.label}>
                            <ListItem button key={item.id}
                                      onClick={onClick}>
                                <ListItemIcon>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.label}/>
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
