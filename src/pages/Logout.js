import React from "react";
import {logoutUser} from "../controllers/UserData";
import {useHistory, withRouter} from "react-router-dom";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {refreshAll} from "../controllers/Store";
import {useFirebase, usePages, useStore} from "../controllers";

const Logout = (props) => {
    const {immediate = true} = props;
    const pages = usePages();
    const store = useStore();
    const firebase = useFirebase();
    const history = useHistory();

    const doLogout = () => {
        logoutUser(firebase, store)()
            .then(() => {
                firebase
                refreshAll(store);
                history.push(pages.home.route);
            });
    }

    React.useEffect(() => {
        if (immediate) {
            doLogout();
        }
    }, [])

    return <Grid container>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems="flex-end">
            Do you want to log out?
        </Grid>
        <Box m={1}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Button
                size="large"
                color={"secondary"}
                onClick={() => {
                    doLogout();
                }}
                variant={"contained"}
            >
                Logout
            </Button>
        </Grid>
    </Grid>
};

Logout.propTypes = {
    immediate: PropTypes.bool,
    pages: PropTypes.object,
};

export default connect()(withRouter(Logout));
