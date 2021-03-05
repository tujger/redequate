import React from "react";
import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import DialogActions from "@material-ui/core/DialogActions";
import SendIcon from "@material-ui/icons/Send";
import {useTranslation} from "react-i18next";
import NavigationToolbar from "../NavigationToolbar";

export default (
    {
        bottom,
        classes,
        disabled,
        onCancel,
        onSend,
        top,
        title,
        uploadComponent,
    }) => {
    const {t} = useTranslation();

    return <>
        {top && <NavigationToolbar
            backButton={<IconButton
                children={<BackIcon/>}
                disabled={disabled}
                onClick={onCancel}
            />}
            children={title}
            className={classes.toolbar}
            mediumButton={uploadComponent}
            rightButton={<IconButton
                aria-label={t("Common.Send")}
                children={<SendIcon/>}
                onClick={onSend}
                style={{color: "inherit"}}
                title={t("Common.Send")}
            />}
        />}
        {bottom && <DialogActions>
            <Grid item xs>
                <Grid container>
                    <Grid item>{uploadComponent}</Grid>
                </Grid>
            </Grid>
            <Button onClick={onCancel} color={"secondary"} disabled={disabled}>
                {t("Common.Cancel")}
            </Button>
            <Button onClick={onSend} color={"secondary"} disabled={disabled}>
                {t("Common.Send")}
            </Button>
        </DialogActions>}
    </>
};
