import React from "react";
import {Button, ButtonGroup, Grid, Typography, FormControlLabel, Checkbox} from "@material-ui/core";
import ProfileComponent from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import {
  logoutUser,
  sendConfirmationEmail,
  updateUserPrivate,
  fetchUserPrivate,
  updateUserPublic,
  user
} from "../controllers/User";
import {Link, Redirect, withRouter} from "react-router-dom";
import {connect} from "react-redux";
import {refreshAll} from "../controllers/Store";
import {
  hasNotifications,
  setupReceivingNotifications,
  notifySnackbar
} from "../controllers/Notifications";
import {fetchDeviceId} from "../controllers/General";

const Profile = (props) => {
  const {dispatch, firebase, pages, store} = props;
  const [state, setState] = React.useState({disabled: false});
  const {disabled} = state;

  if (!user.uid()) {
    return <Redirect to={pages.users.route}/>
  }

  const handleNotifications = (evt, enable) => {
    dispatch(ProgressView.SHOW);
    setState({...state, disabled: true});
    if (enable) {
      // let token = "token" + user.uid();
      setupReceivingNotifications(firebase)
        .then(token => fetchUserPrivate(firebase)(user.uid())
          .then(data => updateUserPrivate(firebase)(user.uid(), fetchDeviceId(), {notification: token}))
          .then(result => {
            notifySnackbar({title: "Subscribed"});
            dispatch(ProgressView.HIDE);
            setState({...state, disabled: false});
          }))
      .catch(notifySnackbar)
      .finally(() => {
        dispatch(ProgressView.HIDE);
        setState({...state, disabled: false});
      });
    } else {
      fetchUserPrivate(firebase)(user.uid())
        .then(data => updateUserPrivate(firebase)(user.uid(), fetchDeviceId(), {notification: null}))
        .then(result => {
          localStorage.removeItem("notification-token");
          notifySnackbar({title: "Unsubscribed"});
        })
        .catch(notifySnackbar)
        .finally(() => {
          dispatch(ProgressView.HIDE);
          setState({...state, disabled: false});
        });
    }
  };

  return <div>
    <ProfileComponent user={user}/>
    {!user.public().emailVerified && <Grid container>
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
      {!user.public().emailVerified && <Button
        color="primary"
        onClick={() => {
          refreshAll(store);
          dispatch(ProgressView.SHOW);
          sendConfirmationEmail(firebase, store)({email: user.public().email})
            .then(() => {
              refreshAll(store);
            }).catch(error => {
              refreshAll(store);
            });
        }}
        variant={"contained"}
      >
        Resend confirmation
      </Button>}
      {user.public().emailVerified && <Button
        color="primary"
        // onClick={() => {
        //     props.history.push(pages.edituser.route);
        // }}
        variant={"contained"}
        component={React.forwardRef((props, ref) => (
          <Link ref={ref} to={{
            pathname: pages.edituser.route,
            state: {data: {uid:user.uid(), role:user.role(), ...user.public()}, tosuccessroute: pages.profile.route},
          }} {...props}/>
        ))}
      >
        Edit
      </Button>}
    </ButtonGroup>
  </div>;
};

export default connect()(withRouter(Profile));
