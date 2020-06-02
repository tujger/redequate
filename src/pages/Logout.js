import React from "react";
import {logoutUser} from "../controllers/User";
import {withRouter} from "react-router-dom";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {refreshAll} from "../controllers/Store";

const Logout = (props) => {
    const {immediate = true, history, pages, firebase, store} = props;

    const doLogout = () => {
        logoutUser(firebase)();
        refreshAll(store);
        history.push(pages.home.route);
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
                color="primary"
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
