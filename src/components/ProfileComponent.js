import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import GoogleLogo from "../images/google-logo.svg"
import UserIcon from "@material-ui/icons/Mail";
import MailIcon from "@material-ui/icons/Mail";
import {withRouter} from "react-router-dom";
import {useFirebase} from "../controllers";
import EmptyAvatar from "@material-ui/icons/Person";
import NameIcon from "@material-ui/icons/Person";
import AddressIcon from "@material-ui/icons/LocationCity";
import PhoneIcon from "@material-ui/icons/Phone";

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
        color: "darkgray",
        objectFit: "cover"
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    }
});

const ProfileComponent = (props) => {
    const {classes, user, userData, additionalPublicFields} = props;
    const firebase = useFirebase();


    console.log(additionalPublicFields)
    if(userData) {
        return <Grid container>
            <Grid item xs>
                {userData.public.image ? <img src={userData.public.image} alt="" className={classes.image}/>
                : <EmptyAvatar className={classes.image}/>}
            </Grid>
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
            <Grid container spacing={1}>
                <Grid item>
                    <NameIcon/>
                </Grid>
                <Grid item xs>
                <Typography>{userData.public.name}</Typography>
                </Grid>
            </Grid>
            <Grid container spacing={1}>
                <Grid item>
                    <MailIcon/>
                </Grid>
                <Grid item xs>
                <Typography>{userData.public.email}</Typography>
                </Grid>
            </Grid>
            {userData.public.address && <Grid container spacing={1}>
                <Grid item>
                    <AddressIcon/>
                </Grid>
                <Grid item xs>
                <Typography>{userData.public.address}</Typography>
                </Grid>
            </Grid>}
            {userData.public.phone && <Grid container spacing={1}>
                <Grid item>
                    <PhoneIcon/>
                </Grid>
                <Grid item xs>
                <Typography>{userData.public.phone}</Typography>
                </Grid>
            </Grid>}
            <Grid container spacing={1}>
                <Typography>Since {userData.created}</Typography>
            </Grid>

            {additionalPublicFields && additionalPublicFields.map(field => {
                return <React.Fragment key={field.id}>
                    <Grid container spacing={1}>
                        <Grid item>
                            {field.icon}
                        </Grid>
                        <Grid item xs>
                            <Typography>{field.viewComponent(userData)}</Typography>
                        </Grid>
                    </Grid>
                </React.Fragment>
            })}

        </Grid>
    }

    return <Grid container>
        <Grid item xs>
            {user.public().image ? <img src={user.public().image} alt="" className={classes.image}/>
            : <EmptyAvatar className={classes.image}/>}
        </Grid>
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
        <Grid container spacing={1}>
            <Grid item>
                <NameIcon/>
            </Grid>
            <Grid item xs>
            <Typography>{user.public().name && user.public().name !== user.public().email
            && user.public().name}</Typography>
            </Grid>
        </Grid>
        <Grid container spacing={1}>
            <Grid item>
                <MailIcon/>
            </Grid>
            <Grid item xs>
            <Typography>{user.public().email}</Typography>
            </Grid>
        </Grid>
        {user.public().address && <Grid container spacing={1}>
            <Grid item>
                <AddressIcon/>
            </Grid>
            <Grid item xs>
            <Typography>{user.public().address}</Typography>
            </Grid>
        </Grid>}
        {user.public().phone && <Grid container spacing={1}>
            <Grid item>
                <PhoneIcon/>
            </Grid>
            <Grid item xs>
            <Typography>{user.public().phone}</Typography>
            </Grid>
        </Grid>}
        <Grid container>
            <Typography>Since {
                user.public().created && !user.public().created[".sv"]
                && new Date(user.public().created).toLocaleDateString()}</Typography>
        </Grid>
        {additionalPublicFields && additionalPublicFields.map(field => {
            return <React.Fragment key={field.id}>
                <Grid container >
                    <Grid item>
                        {field.icon}
                    </Grid>
                    <Grid item xs>
                        <Typography>{user.public()[field.id]}</Typography>
                    </Grid>
                </Grid>
            </React.Fragment>
        })}
    </Grid>
};

export default withRouter(withStyles(styles)(ProfileComponent));
