import React from "react";
import PropTypes from "prop-types";
import {Card} from "@mui/material";
import {IconButton} from "@mui/material";
import {CardActionArea} from "@mui/material";
import {CardContent} from "@mui/material";
import {CardActions} from "@mui/material";
import {CardMedia} from "@mui/material";
import {SnackbarContent} from "@mui/material";
import {Collapse} from "@mui/material";
import {Button} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandIcon from "@mui/icons-material/ExpandMore";
import CollapseIcon from "@mui/icons-material/ExpandLess";
import {withStyles} from "@mui/styles";

const styles = theme => ({
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
    },

    snackbarContent: {}
});

const RichSnackbarContent = withStyles(styles)(React.forwardRef((props, ref) => {
    const {body, buttonLabel, classes, closeAfterClick = true, closeHandler, image, message, onButtonClick, onClick, variant = "default"} = props;
    const [state, setState] = React.useState({expanded: false});
    const {expanded} = state;

    try {
        const customAction = (color) => <Button
            aria-label={buttonLabel}
            children={buttonLabel}
            size={"small"}
            color={color}
            onClickCapture={((evt) => {
                evt.stopPropagation();
                if (onButtonClick) {
                    if (onButtonClick(evt) === true) closeHandler();
                    else closeHandler();
                }
            })}
        />;
        const expandAction = () => <IconButton
            size={"small"} aria-label={"close"} color={"inherit"}
            onClickCapture={(evt) => {
                evt.stopPropagation();
                setState({...state, expanded: true});
            }}>
            <ExpandIcon fontSize={"small"}/>
        </IconButton>;
        const collapseAction = () => <IconButton
            size={"small"} aria-label={"close"} color={"inherit"}
            onClickCapture={(evt) => {
                evt.stopPropagation();
                setState({...state, expanded: false});
            }}>
            <CollapseIcon fontSize={"small"}/>
        </IconButton>;
        const closeAction = () => <IconButton
            size={"small"} aria-label={"close"} color={"inherit"}
            onClickCapture={(evt) => {
                evt.stopPropagation();
                closeHandler();
            }}>
            <CloseIcon fontSize={"small"}/>
        </IconButton>;
        const clickHandler = evt => {
            onClick && onClick(evt);
            if (closeAfterClick) closeHandler();
        };

        const cardExists = body || image;
        const cardShown = cardExists && expanded;

        return <div className={classes.snackbarContent} ref={ref}>
            <SnackbarContent
                message={message}
                className={["", classes[variant]].join(" ")}
                action={<>
                    {buttonLabel && !cardShown ? customAction("inherit") : null}
                    {cardExists ? (cardShown ? collapseAction() : expandAction()) : null}
                    {buttonLabel ? (onButtonClick ? closeAction() : null) : closeAction()}
                </>}
                onClick={onClick}
            />
            {cardExists && <Collapse in={cardShown} timeout={"auto"} unmountOnExit>
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
    } catch (e) {
        console.error(e);
    }
}));

RichSnackbarContent.propTypes = {
    body: PropTypes.any,
    buttonLabel: PropTypes.string,
    closeAfterClick: PropTypes.bool,
    closeHandler: PropTypes.func.isRequired,
    image: PropTypes.string,
    message: PropTypes.any.isRequired,
    onButtonClick: PropTypes.func,
    onClick: PropTypes.func,
    variant: PropTypes.oneOf(["default", "error", "warning", "info", "success"])
};

export default RichSnackbarContent;
