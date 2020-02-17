import React from "react";
import {fetchUser, updateUser, user} from "../controllers/User";
import LoadingComponent from "../components/LoadingComponent";
import PasswordField from "../components/PasswordField";
import ProgressView from "../components/ProgressView";
import {Link, Redirect, withRouter} from "react-router-dom";
import {Box, Button, ButtonGroup, FormHelperText, Grid, TextField} from "@material-ui/core";
import {Lock, Mail as UserIcon} from "@material-ui/icons";
import GoogleLogo from "../images/google-logo.svg";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {refreshAll} from "../controllers";

const Login = (props) => {
    const {signup = true, history, location, popup = true, dispatch, pages, firebase, store} = props;
    const [state, setState] = React.useState({
        email: "",
        password: "",
        error: "",
        requesting: false
    });
    const {email, password, error, requesting} = state;
    const requestLoginGoogle = () => {
        dispatch(ProgressView.SHOW);
        const provider = new firebase.auth.GoogleAuthProvider();
        if (popup) {
            setState({...state, requesting: true});
            firebase.auth().signInWithPopup(provider).then(loginSuccess).catch(loginError);
        } else {
            window.localStorage.setItem(pages.login.route, provider.providerId);
            firebase.auth().signInWithRedirect(provider);
        }
    };
    const requestLoginPassword = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, requesting: true});
        firebase.auth().signInWithEmailAndPassword(email, password).then(loginSuccess).catch(loginError);
    };
    const loginSuccess = response => {
        fetchUser(firebase)(response.user.uid, (data) => {
            updateUser(firebase)({...data, current: true}, () => {
              refreshAll(store);
                setState({...state, requesting: false});
                if (location && location.pathname === pages.login.route) {
                    history.push(pages.profile.route);
                }
            }, loginError);
        }, loginError);
    };
    const loginError = error => {
        dispatch(ProgressView.HIDE);
        console.error(error);
        setState({...state, error: error.message, requesting: false});
    };

    if (!popup && window.localStorage.getItem(pages.login.route)) {
        window.localStorage.removeItem(pages.login.route);
        firebase.auth().getRedirectResult().then(loginSuccess).catch(loginError);
        return <LoadingComponent/>;
    }
    if (user.currentUser()) {
        return <Redirect to={pages.profile.route}/>
    }

    return <Grid container>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <UserIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    disabled={requesting}
                    label="E-mail"
                    fullWidth
                    onChange={ev => {
                        setState({...state, email: ev.target.value});
                    }}
                    value={email}
                />
            </Grid>
        </Grid>
        <Box m={1}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <Lock/>
            </Grid>
            <Grid item xs>
                <PasswordField
                    disabled={requesting}
                    label={"Password"}
                    onChange={ev => {
                        setState({...state, password: ev.target.value});
                    }}
                    value={password}
                />
            </Grid>
        </Grid>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <Box m={1.5}/>
            </Grid>
            <Grid item>
                <FormHelperText error>
                    {error}
                </FormHelperText>
            </Grid>
        </Grid>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <Box m={1.5}/>
            </Grid>
            <Grid item>
                <Link to={pages.restore.route}>Forgot password?</Link>
            </Grid>
        </Grid>
        <Box m={1}/>
        <ButtonGroup variant="contained" color="primary" size="large" fullWidth>
            <Button onClick={requestLoginPassword}>
                Login
            </Button>
            {signup && <Button onClick={() => props.history.push(pages.signup.route)}>
                Sign up
            </Button>}
        </ButtonGroup>
        <Box m={2}/>
        <Grid container justify="center">
            <Button onClick={requestLoginGoogle}>
                <img src={GoogleLogo} width={20} height={20} alt={""}/>
                <Box m={0.5}/>
                Log in with Google
            </Button>
        </Grid>
    </Grid>
};

Login.propTypes = {
    signup: PropTypes.bool,
    popup: PropTypes.bool,
    pages: PropTypes.object,
};

export default connect()(withRouter(Login));
