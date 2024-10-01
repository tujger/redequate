import {Box, Button, Grid} from "@mui/material";
import {withStyles} from "@mui/styles";
import PropTypes from "prop-types";
import React from "react";
import {useTranslation} from "react-i18next";
import {connect} from "react-redux";
import {useHistory} from "react-router-dom";
import LoadingComponent from "../components/LoadingComponent";
import {usePages, useStore} from "../controllers/General";
import {refreshAll} from "../controllers/Store";
import {styles} from "../controllers/Theme";
import {logoutUser} from "../controllers/UserData";
import withRouter from "../controllers/withRouter.js";

const Logout = (props) => {
    const {classes, immediate = true} = props;
    const history = useHistory();
    const pages = usePages();
    const store = useStore();
    const {t} = useTranslation();

    const doLogout = () => {
        window.localStorage.removeItem(pages.login.route);
        logoutUser(store)
            .then(() => {
                refreshAll(store);
                history.push(pages.home.route);
            });
    }

    React.useEffect(() => {
        if (immediate) {
            doLogout();
        }
    }, [])

    if (immediate) {
        return <Grid container>
            <Box m={1}/>
            <LoadingComponent text={t("Login.Logging out...")}/>
            <Box m={1}/>
        </Grid>;
    }
    return <Grid container className={classes.center}>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems={"flex-end"}>
            {t("Login.Do you want to log out?")}
        </Grid>
        <Box m={1}/>
        <Grid container spacing={1} alignItems={"flex-end"}>
            <Button
                size={"large"}
                children={t("Login.Logout")}
                color={"secondary"}
                onClick={() => {
                    doLogout();
                }}
                variant={"contained"}
            />
        </Grid>
    </Grid>
};

Logout.propTypes = {
    immediate: PropTypes.bool,
};

export default connect()(withRouter(withStyles(styles)(Logout)));
