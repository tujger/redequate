import React from "react";
import PropTypes from "prop-types";
import {MenuItem, withStyles} from "@material-ui/core";
import {matchRole, user} from "../controllers/User";
import {Link} from "react-router-dom";
import Button from "@material-ui/core/Button";
import Popper from "@material-ui/core/Popper";
import MenuList from "@material-ui/core/MenuList";
import AvatarView from "../components/AvatarView";

const styles = theme => ({
  header: {
    ...theme.typography.button,
    display: "flex",
  },
  indent: {
    ...theme.typography.button,
  },
  label: {
    color: "inherit",
    cursor: "default",
    textDecoration: "none",
  },
  topmenu: {
    ...theme.typography.button,
    alignItems: "center",
    backgroundColor: "transparent", //theme.palette.background.paper,
    display: "flex",
    // position: "fixed",
    // left: 0,
    // right: 0,
    // top: 0,
    zIndex: 1,
  },
  menusection: {
    backgroundColor: theme.palette.background.default,
    color: theme.palette.getContrastText(theme.palette.background.default),
    boxShadow: theme.shadows[1],
  },
  menuitem: {
    fontSize: "inherit"
  },
  profileitem: {
    // marginLeft: "auto",
    margin: theme.spacing(.5),
  }

});

const MenuSection = withStyles(styles)(props => {
  const {items, classes} = props;
  const [first, ...menu] = items;
  const [state, setState] = React.useState({anchor: null});
  const {anchor} = state;

  if (!matchRole(first.roles, user)) return null;

  return <Button
    className={"MuiTopMenu-section"}
    onClickCapture={ev => setState({...state, anchor: ev.currentTarget})}
    onMouseEnter={ev => setState({...state, anchor: ev.currentTarget})}
    onMouseLeave={() => setState({...state, anchor: null})}
    variant={"text"}>
    {first.label}
    <Popper
      anchorEl={anchor}
      className={classes.menusection}
      disablePortal
      onClose={() => setState({...state, anchor: null})}
      onMouseLeave={() => setState({...state, anchor: null})}
      open={Boolean(anchor)}
      placement={"bottom-end"}
      role={undefined}>
      <MenuList>{menu.map((item, index) => {
        if (!matchRole(item.roles, user)) return null;
        return <Link to={item.route}
                     key={index}
                     className={classes.label}
                     onClick={() => {
                       setState({...state, anchor: null})
                     }}>
          <MenuItem
            button
            children={item.label}
            className={classes.menuitem}
            key={item.id}/>
        </Link>
      })}</MenuList>
    </Popper>
  </Button>
});

const TopMenu = props => {
  const {items, classes, className, pages} = props;
  return <div className={["MuiTopMenu-root", classes.topmenu, className].join(" ")}>
    {items.map((list, index) => <MenuSection key={index} items={list}/>)}
    {user.uid() &&
    <Link to={pages.profile.route} className={[classes.label, classes.profileitem].join(" ")}>
      <AvatarView user={user}/>
    </Link>}
  </div>
};

TopMenu.propTypes = {
  children: PropTypes.array,
  className: PropTypes.string,
  items: PropTypes.array,
  pages: PropTypes.object,
};

export default withStyles(styles)(TopMenu);
