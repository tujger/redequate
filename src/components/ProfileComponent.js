import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import GoogleLogo from "../images/google-logo.svg"
import UserIcon from "@material-ui/icons/Mail";
import {withRouter} from "react-router-dom";
import {useFirebase} from "../controllers";

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
        objectFit: "cover"
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    }
});

const ProfileComponent = (props) => {
    const {classes, user, userData} = props;
    const firebase = useFirebase();

    if(userData) {
        console.log(userData)
        return <Grid container>
            {userData.public.image && <Grid item xs>
                <img src={userData.public.image} alt="" className={classes.image}/>
            </Grid>}
            {userData.public.provider && userData.public.provider === "google.com" && <Grid item xs>
                <Grid container justify="flex-end">
                    <img src={GoogleLogo} width={40} height={40} alt=""/>
                </Grid>
                <Grid container justify="flex-end">
                    <Typography>Signed with Google</Typography>
                </Grid>
            </Grid>}
            {userData.public.provider && userData.public.provider === "password" && <Grid item xs>
                <Grid container justify="flex-end">
                    <UserIcon/>
                    {/*<img src={GoogleLogo} width={40} height={40} alt=""/>*/}
                </Grid>
                <Grid container justify="flex-end">
                    <Typography>Signed with e-mail</Typography>
                </Grid>
                {!userData.public.emailVerified && <Grid container justify="flex-end">
                    <Typography>Not verified</Typography>
                </Grid>}
            </Grid>}
            <Grid container>
                <Typography>{userData.public.name}</Typography>
            </Grid>
            <Grid container>
                <Typography>{userData.public.email}</Typography>
            </Grid>
            <Grid container>
                <Typography>{userData.public.address}</Typography>
            </Grid>
            <Grid container>
                <Typography>{userData.public.phone}</Typography>
            </Grid>
            <Grid container>
                <Typography>{userData.created}</Typography>
            </Grid>
        </Grid>
    }

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
            <Typography>{user.public().name && user.public().name !== user.public().email
            && user.public().name}</Typography>
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
            <Typography>{
                user.public().created && !user.public().created[".sv"]
                && new Date(user.public().created).toLocaleString()}</Typography>
        </Grid>
    </Grid>
};

export default withRouter(withStyles(styles)(ProfileComponent));
