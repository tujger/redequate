import React from "react";
import {Button, ButtonGroup, Grid, Typography, FormControlLabel, Checkbox} from "@material-ui/core";
import ProfileComponent from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import {logoutUser, sendConfirmationEmail, updateUserPrivate, user} from "../controllers/User";
import {Link, Redirect, withRouter} from "react-router-dom";
import {connect} from "react-redux";
import {refreshAll} from "../controllers/Store";
import {hasNotifications, setupReceivingNotifications, pushNotificationsSnackbarNotify} from "../controllers/PushNotifications";

const Profile = (props) => {
    const {dispatch, firebase, pages, store} = props;
    const [state, setState] = React.useState({disabled: false});
    const {disabled} = state;

    let currentUser = user.currentUser();
    if (!currentUser) {
        return <Redirect to={pages.users.route}/>
    }

    const onError = error => {
      dispatch(ProgressView.HIDE);
      setState({...state, disabled: false});
      pushNotificationsSnackbarNotify({
        title: "Setup notifications failed: " + error.message,
        priority: "high",
        variant: "error",
      });
    };

    const handleNotifications = (evt, enable) => {
      dispatch(ProgressView.SHOW);
      setState({...state, disabled: true});
      if(enable) {
        setupReceivingNotifications(firebase, null, token => {
          updateUserPrivate(firebase)({notifications: token}, result => {
            console.log(result);
            dispatch(ProgressView.HIDE);
            setState({...state, disabled: false});
            pushNotificationsSnackbarNotify({
              title: token,
              priority: "high",
              variant: "info",
            });
          }, onError)
        }, onError);
      } else {
        console.log("DISABLE NOTIF")
      }
    };

    return <div>
        <ProfileComponent data={currentUser}/>
        {!currentUser.emailVerified && <Grid container>
            <Grid item xs>
                <Typography>Note! You are still did not confirmed your email. Some features will not
                    be available.</Typography>
            </Grid>
        </Grid>}
        <Grid container><FormControlLabel
          control={
            <Checkbox
              disabled={disabled}
              checked={hasNotifications()}
              onChange={handleNotifications}
            />
          }
          label={"Get notifications"}
        /></Grid>
        <ButtonGroup disabled={disabled} variant="contained" color="primary" size="large">
            <Button
                color="primary"
                onClick={() => {
                    logoutUser(firebase)();
                    refreshAll(store);
                }}
                variant={"contained"}
            >
                Logout
            </Button>
            {!currentUser.emailVerified && <Button
                color="primary"
                onClick={() => {
                  refreshAll(store);
                            dispatch(ProgressView.SHOW);
                    sendConfirmationEmail(firebase, store)({
                        email: currentUser.email,
                        onsuccess: () => {
                          refreshAll(store);
                        }, onerror: error => {
                        refreshAll(store);
                        }
                    })
                }}
                variant={"contained"}
            >
                Resend confirmation
            </Button>}
            {currentUser.emailVerified && <Button
                color="primary"
                // onClick={() => {
                //     props.history.push(pages.edituser.route);
                // }}
                variant={"contained"}
                component={React.forwardRef((props, ref) => (
                    <Link ref={ref} to={{
                        pathname: pages.edituser.route,
                        state: {data: currentUser, tosuccessroute: pages.profile.route},
                    }} {...props}/>
                ))}
            >
                Edit
            </Button>}
        </ButtonGroup>
    </div>;
};

export default connect()(withRouter(Profile));
