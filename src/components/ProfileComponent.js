import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import {withRouter} from "react-router-dom";
import EmptyAvatar from "@material-ui/icons/Person";
import GoogleLogo from "../images/google-logo.svg"
import UserIcon from "@material-ui/icons/Mail";
import AvatarView from "./AvatarView";

const styles = theme => ({
    image: {
        [theme.breakpoints.up("sm")]: {
            width: theme.spacing(18),
            height: theme.spacing(18),
        },
        [theme.breakpoints.down("sm")]: {
            width: theme.spacing(15),
            height: theme.spacing(15),
        },
        color: "darkgray",
        objectFit: "cover"
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    imagerow: {
        [theme.breakpoints.up("sm")]: {
            width: "auto",
        },
        [theme.breakpoints.down("sm")]: {
            alignItems: "center",
            justifyContent: "center",
            marginTop: theme.spacing(3),
        },
    },
    inforows: {
        [theme.breakpoints.up("sm")]: {
            flex: 1,
            marginLeft: theme.spacing(4),
            width: "auto",
        },
        [theme.breakpoints.down("sm")]: {
            marginBottom: theme.spacing(3),
        },
    },
    inforow: {
        [theme.breakpoints.down("sm")]: {
            alignItems: "center",
            justifyContent: "center",
        },
    },
    signWith: {
        alignItems: "flex-end",
        display: "flex",
        justifyContent: "flex-end",
        flexDirection: "column",
        padding: theme.spacing(1),
        [theme.breakpoints.down("sm")]: {
            flexDirection: "column-reverse",
            position: "absolute",
            top: 0,
            right: 0,
        },
    }
});

const ProfileComponent = (props) => {
    const {classes, userData, publicFields, provider = true} = props;

    return <Grid container style={{position: "relative"}}>
        <Grid container spacing={1} className={classes.imagerow}>
            <Grid item>
                {userData.image ? <AvatarView
                        className={classes.image}
                        image={userData.image}
                        initials={userData.initials}
                        verified={userData.verified}/>
                    : <EmptyAvatar className={classes.image}/>}
            </Grid>
        </Grid>
        <Grid container className={classes.inforows}>
            {publicFields && publicFields.map(field => {
                if (!userData.public[field.id] && !field.viewComponent) return null;
                return <React.Fragment key={field.id}>
                    <Grid container spacing={1} className={classes.inforow}>
                        {/*<Grid item>
                            {field.icon}
                        </Grid>*/}
                        <Grid item>
                            {field.viewComponent
                                ? field.viewComponent(userData)
                                : <Typography variant={"body2"}>{userData.public[field.id]}</Typography>
                            }
                        </Grid>
                    </Grid>
                </React.Fragment>
            })}
        </Grid>
        {provider && <Grid item className={classes.signWith}>
            {userData.public.provider && userData.public.provider === "google.com" && <React.Fragment>
                <Grid container justify="flex-end">
                    <img src={GoogleLogo} width={40} height={40} alt=""/>
                </Grid>
                <Typography variant={"body2"}>Signed with Google</Typography>
            </React.Fragment>}
            {userData.public.provider && userData.public.provider === "password" && <React.Fragment>
                <Grid container justify="flex-end">
                    <UserIcon/>
                </Grid>
                <Typography variant={"body2"}>Signed with e-mail</Typography>
                {!userData.verified && <Typography variant={"body2"}>Not verified</Typography>}
            </React.Fragment>}
            {userData.public.provider && userData.public.provider !== "password" && userData.public.provider !== "google.com" &&
            <React.Fragment>
                <Typography variant={"body2"}>Signed with {userData.public.provider}</Typography>
                {!userData.verified && <Typography variant={"body2"}>Not verified</Typography>}
            </React.Fragment>}
        </Grid>}
    </Grid>
};

export default withRouter(withStyles(styles)(ProfileComponent));
