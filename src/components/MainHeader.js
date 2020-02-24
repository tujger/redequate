import React from "react";
import PropTypes from "prop-types";
import {Hidden, IconButton, withStyles} from "@material-ui/core";
import {ChevronLeft} from "@material-ui/icons";

const styles = theme => ({
  header: {
    ...theme.mixins.toolbar,
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
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
});

const MainHeader = props => {
  const {classes, onClick, image} = props;
  return <div className={classes.header} style={{
    backgroundImage: `url(${image})`
  }}>
    <Hidden mdUp implementation="css">
      <IconButton onClick={onClick}>
        <ChevronLeft/>
      </IconButton>
    </Hidden>
  </div>
};

MainHeader.propTypes = {
  items: PropTypes.array,
  onClick: PropTypes.func
};

export default withStyles(styles)(MainHeader);