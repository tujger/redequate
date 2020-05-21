import React from "react";
import PropTypes from "prop-types";
import Card from "@material-ui/core/Card";
import IconButton from "@material-ui/core/IconButton";
import CardActionArea from "@material-ui/core/CardActionArea";
import CardContent from "@material-ui/core/CardContent";
import CardActions from "@material-ui/core/CardActions";
import CardMedia from "@material-ui/core/CardMedia";
import SnackbarContent from "@material-ui/core/SnackbarContent";
import Collapse from "@material-ui/core/Collapse";
import makeStyles from "@material-ui/styles/makeStyles";
import Button from "@material-ui/core/Button";
import CloseIcon from "@material-ui/icons/Close";
import ExpandIcon from "@material-ui/icons/ExpandMore";
import CollapseIcon from "@material-ui/icons/ExpandLess";

const useStyles = makeStyles(theme => {
  try {
    return {
      error: {
        backgroundColor: theme.palette.error.main,
        color: theme.palette.error.contrastText,
      },
      info: {
        backgroundColor: theme.palette.info.main,
        color: theme.palette.info.contrastText,
      },
      success: {
        backgroundColor: theme.palette.success.main,
        color: theme.palette.success.contrastText,
      },
      warning: {
        backgroundColor: theme.palette.warning.dark,
        color: theme.palette.warning.contrastText,
      }
    }
  } catch(e) {
    console.error(e);
  }
});

const RichSnackbarContent = React.forwardRef((props, ref) => {
  const {body, buttonLabel, closeAfterClick = true, closeHandler, image, message, onButtonClick, onClick, variant="default"} = props;
  const [state, setState] = React.useState({expanded: false});
  const {expanded} = state;

  try {
    const classes = useStyles();

    const customAction = (color) => <Button
      size="small" aria-label="close" color={color}
      onClickCapture={((evt) => {
        evt.stopPropagation();
        onButtonClick ? onButtonClick(evt) : closeHandler();
      })}>
      {buttonLabel}
    </Button>;
    const expandAction = () => <IconButton
      size="small" aria-label="close" color="inherit"
      onClickCapture={(evt) => {
        evt.stopPropagation();
        setState({...state, expanded: true});
      }}>
      <ExpandIcon fontSize="small"/>
    </IconButton>;
    const collapseAction = () => <IconButton
      size="small" aria-label="close" color="inherit"
      onClickCapture={(evt) => {
        evt.stopPropagation();
        setState({...state, expanded: false});
      }}>
      <CollapseIcon fontSize="small"/>
    </IconButton>;
    const closeAction = () => <IconButton
      size="small" aria-label="close" color="inherit"
      onClickCapture={(evt) => {
        evt.stopPropagation();
        closeHandler();
      }}>
      <CloseIcon fontSize="small"/>
    </IconButton>;
    const clickHandler = evt => {
      onClick && onClick(evt);
      if (closeAfterClick) closeHandler();
    };

    const cardExists = body || image;
    const cardShown = cardExists && expanded;

    return <div ref={ref}>
      <SnackbarContent
        message={message}
        className={classes[variant]}
        action={<React.Fragment>
          {buttonLabel && !cardShown ? customAction("inherit") : null}
          {cardExists ? (cardShown ? collapseAction() : expandAction()) : null}
          {buttonLabel ? (onButtonClick ? closeAction() : null) : closeAction()}
        </React.Fragment>}
        onClick={onClick}
      />
      {cardExists && <Collapse in={cardShown} timeout="auto" unmountOnExit>
        <Card raised>
          <CardActionArea style={{display: "flex", alignItems: "stretch"}} onClick={clickHandler}>
            {image && <CardMedia
              image={image}
              title={message}
              style={{
                backgroundSize: "contain",
                height: body ? "auto" : 150,
                margin: 4,
                width: body ? 100 : "100%",
              }}
            />}
            {body && <CardContent>
              {body}
            </CardContent>}
          </CardActionArea>
          <CardActions>
            {customAction("primary")}
          </CardActions>
        </Card>
      </Collapse>}
    </div>
  } catch(e) {
    console.error(e);
  }
});

RichSnackbarContent.propTypes = {
  body: PropTypes.any,
  buttonLabel: PropTypes.string,
  closeAfterClick: PropTypes.bool,
  closeHandler: PropTypes.func.isRequired,
  image: PropTypes.string,
  message: PropTypes.string.isRequired,
  onButtonClick: PropTypes.func,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(["default", "error", "warning", "info", "success"])
};

export default RichSnackbarContent;
