import React from "react";
import {Redirect, useHistory} from "react-router-dom";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import UserIcon from "@material-ui/icons/Mail";
import {useDispatch} from "react-redux";
import withStyles from "@material-ui/styles/withStyles";
import {useTranslation} from "react-i18next";
import {sendPasswordResetEmail, useCurrentUserData} from "../controllers/UserData";
import ProgressView from "../components/ProgressView";
import notifySnackbar from "../controllers/notifySnackbar";
import {usePages} from "../controllers/General";
import {styles} from "../controllers/Theme";

const RestorePassword = ({classes}) => {
    const [state, setState] = React.useState({
        email: "",
        requesting: false
    });
    const {email, requesting} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const history = useHistory();
    const currentUserData = useCurrentUserData();
    const {t} = useTranslation();

    const requestRestorePassword = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        sendPasswordResetEmail(email)
            .then(() => {
                notifySnackbar(t("User.Instructions have been sent to e-mail."));
                history.push(pages.login.route);
            }).catch(error => {
                notifySnackbar(error);
            }).finally(() => {
                dispatch(ProgressView.HIDE);
                setState({...state, requesting: false});
            });
    };

    if (currentUserData && currentUserData.id) {
        return <Redirect to={pages.profile.route}/>
    }

    return <Grid container className={classes.center}>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems={"flex-end"}>
            <Grid item>
                <UserIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    color={"secondary"}
                    disabled={requesting}
                    label={t("User.E-mail")}
                    fullWidth
                    onChange={ev => setState({...state, email: ev.target.value})}
                    value={email}
                />
            </Grid>
        </Grid>
        <Box m={2}/>
        <ButtonGroup variant={"contained"} color={"secondary"} size={"large"} fullWidth>
            <Button
                aria-label={t("User.Restore password")}
                children={t("User.Restore")}
                onClick={requestRestorePassword}
            />
            <Button
                aria-label={t("Common.Cancel")}
                children={t("Common.Cancel")}
                onClick={() => history.push(pages.login.route)}
            />
        </ButtonGroup>
    </Grid>
};

export default withStyles(styles)(RestorePassword);
