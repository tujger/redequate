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
    const {classes, data} = props;

    return <Grid container>
            {data.image && <Grid item xs>
                <img src={data.image} alt="" className={classes.image}/>
            </Grid>}
            {data.provider && data.provider === "google.com" && <Grid item xs>
                <Grid container justify="flex-end">
                    <img src={GoogleLogo} width={40} height={40} alt=""/>
                </Grid>
                <Grid container justify="flex-end">
                    <Typography>Signed with Google</Typography>
                </Grid>
            </Grid>}
            {data.provider && data.provider === "password" && <Grid item xs>
                <Grid container justify="flex-end">
                    <UserIcon/>
                    {/*<img src={GoogleLogo} width={40} height={40} alt=""/>*/}
                </Grid>
                <Grid container justify="flex-end">
                    <Typography>Signed with e-mail</Typography>
                </Grid>
                {!data.emailVerified && <Grid container justify="flex-end">
                    <Typography>Not verified</Typography>
                </Grid>}
            </Grid>}
            <Grid container>
                <Typography>{data.name}</Typography>
            </Grid>
            <Grid container>
                <Typography>{data.email}</Typography>
            </Grid>
            <Grid container>
                <Typography>{data.address}</Typography>
            </Grid>
            <Grid container>
                <Typography>{data.phone}</Typography>
            </Grid>
            <Grid container>
                <Typography>{new Date(data.created).toLocaleString()}</Typography>
            </Grid>
        </Grid>
};

export default withRouter(withStyles(styles)(ProfileComponent));
