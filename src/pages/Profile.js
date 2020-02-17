import React from "react";
import {Button, ButtonGroup, Grid, Typography} from "@material-ui/core";
import ProfileComponent from "../components/ProfileComponent";
import ProgressView from "../components/ProgressView";
import {logoutUser, sendConfirmationEmail, user} from "../controllers/User";
import {Link, Redirect, withRouter} from "react-router-dom";
import {connect} from "react-redux";
import {refreshAll} from "../controllers";

const Profile = (props) => {
    const {dispatch, firebase, pages, store} = props;
    let currentUser = user.currentUser();
    if (!currentUser) {
        return <Redirect to={pages.users.route}/>
    }
    return <div>
        <ProfileComponent data={currentUser}/>
        {!currentUser.emailVerified && <Grid container>
            <Grid item xs>
                <Typography>Note! You are still did not confirmed your email. Some features will not
                    be available.</Typography>
            </Grid>
        </Grid>}
        <ButtonGroup variant="contained" color="primary" size="large">
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
