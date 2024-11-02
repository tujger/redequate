import React from "react";
import {Grid} from "@mui/material";
import {Button} from "@mui/material";
import {IconButton} from "@mui/material";
import BackIcon from "@mui/icons-material/ArrowBack";
import {DialogActions} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import {useTranslation} from "react-i18next";
import NavigationToolbar from "../NavigationToolbar";
import styles from "./styles/NewPostComponent.module.css";

export default (
    {
        bottom,
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
                className={styles.button}
                disabled={disabled}
                onClick={onCancel}
            />}
            children={title}
            className={styles.toolbar}
            mediumButton={uploadComponent}
            rightButton={<IconButton
                aria-label={t("Common.Send")}
                children={<SendIcon/>}
                className={styles.button}
                onClick={onSend}
                title={t("Common.Send")}
            />}
        />}
        {bottom && <DialogActions
            className={styles.actions}
        >
            <Grid item xs>
                <Grid container>
                    <Grid item>{uploadComponent}</Grid>
                </Grid>
            </Grid>
            <Button onClick={onCancel}
                    className={styles.button}
                    disabled={disabled}>
                {t("Common.Cancel")}
            </Button>
            <Button onClick={onSend}
                    className={styles.button}
                    disabled={disabled}>
                {t("Common.Send")}
            </Button>
        </DialogActions>}
    </>
};
