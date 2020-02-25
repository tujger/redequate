import React from "react";
import {Grid, Typography, withStyles} from "@material-ui/core";
import GoogleLogo from "../images/google-logo.svg"
import {Mail as UserIcon} from "@material-ui/icons";
import {withRouter} from "react-router-dom";

const styles = theme => ({
    image: {
        [theme.breakpoints.up("sm")]: {
            width: theme.spacing(18),
            height: theme.spacing(18),
        },
        [theme.breakpoints.down("sm")]: {
            width: theme.spacing(12),
            height: theme.spacing(12),
        },
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    }
});

const ProfileComponent = (props) => {
    const {classes, user} = props;
    return <Grid container>
            {user.public().image && <Grid item xs>
                <img src={user.public().image} alt="" className={classes.image}/>
            </Grid>}
            {user.public().provider && user.public().provider === "google.com" && <Grid item xs>
                <Grid container justify="flex-end">
                    <img src={GoogleLogo} width={40} height={40} alt=""/>
                </Grid>
                <Grid container justify="flex-end">
                    <Typography>Signed with Google</Typography>
                </Grid>
            </Grid>}
            {user.public().provider && user.public().provider === "password" && <Grid item xs>
                <Grid container justify="flex-end">
                    <UserIcon/>
                    {/*<img src={GoogleLogo} width={40} height={40} alt=""/>*/}
                </Grid>
                <Grid container justify="flex-end">
                    <Typography>Signed with e-mail</Typography>
                </Grid>
                {!user.public().emailVerified && <Grid container justify="flex-end">
                    <Typography>Not verified</Typography>
                </Grid>}
            </Grid>}
            <Grid container>
                <Typography>{user.public().name}</Typography>
            </Grid>
            <Grid container>
                <Typography>{user.public().email}</Typography>
            </Grid>
            <Grid container>
                <Typography>{user.public().address}</Typography>
            </Grid>
            <Grid container>
                <Typography>{user.public().phone}</Typography>
            </Grid>
            <Grid container>
                <Typography>{new Date(user.public().created).toLocaleString()}</Typography>
            </Grid>
        </Grid>
};

export default withRouter(withStyles(styles)(ProfileComponent));
