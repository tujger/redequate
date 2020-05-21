import React from "react";
import PropTypes from "prop-types";
import Hidden from "@material-ui/core/Hidden";
import IconButton from "@material-ui/core/IconButton";
import withStyles from "@material-ui/styles/withStyles";
import ChevronLeft from "@material-ui/icons/ChevronLeft";

const styles = theme => ({
  header: {
    ...theme.mixins.toolbar,
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    height: 120,
    [theme.breakpoints.up("md")]: {
      display: "flex",
    },
    [theme.breakpoints.down("md")]: {
      alignItems: "flex-start",
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
