import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import {useTranslation} from "react-i18next";
import UserIcon from "@material-ui/icons/Mail";
import GoogleLogo from "../images/google-logo.svg"
import AvatarView from "./AvatarView";
import {styles} from "../controllers/Theme";
import FacebookLogo from "../images/facebook-logo.svg";

const stylesCurrent = theme => ({
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    profileImage: {
        [theme.breakpoints.down("sm")]: {
            width: theme.spacing(25),
        },
    },
    signedWith: {
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
    const {t} = useTranslation();

    return <Grid container className={classes.profile} style={{position: "relative"}}>
        {userData.image && <Grid item className={classes.profileImageContainer}>
            <Grid item className={classes.profileFieldImage}>
                <AvatarView
                    className={classes.profileImage}
                    image={userData.image}
                    initials={userData.initials}
                    verified={userData.verified}/>
            </Grid>
        </Grid>}
        <Grid item className={classes.profileFields}>
            {publicFields && publicFields.map(field => {
                if (!userData.public[field.id] && !field.viewComponent) return null;
                return <React.Fragment key={field.id}>
                    <Grid container className={classes.profileField}>
                        {field.viewComponent
                            ? field.viewComponent(userData)
                            : <Typography variant={"body2"}>{userData.public[field.id]}</Typography>}
                    </Grid>
                </React.Fragment>
            })}
        </Grid>
        {provider && <Grid item className={classes.signedWith}>
            {userData.public.provider && userData.public.provider === "google.com" && <>
                <Grid container justify={"flex-end"}>
                    <img src={GoogleLogo} width={40} height={40} alt={""}/>
                </Grid>
                <Typography variant={"body2"}>{t("User.Signed with {{provider}}", {provider: "Google"})}</Typography>
            </>}
            {userData.public.provider && userData.public.provider === "facebook.com" && <>
                <Grid container justify={"flex-end"}>
                    <img src={FacebookLogo} width={40} height={40} alt={""}/>
                </Grid>
                <Typography variant={"body2"}>{t("User.Signed with {{provider}}", {provider: "Facebook"})}</Typography>
            </>}
            {userData.public.provider && userData.public.provider === "password" && <>
                <Grid container justify={"flex-end"}>
                    <UserIcon/>
                </Grid>
                <Typography variant={"body2"}>{t("User.Signed with {{provider}}", {provider: "e-mail"})}</Typography>
                {!userData.verified && <Typography variant={"body2"}>Not verified</Typography>}
            </>}
            {userData.public.provider && userData.public.provider !== "password" && userData.public.provider !== "google.com" && userData.public.provider !== "facebook.com" &&
            <>
                <Typography variant={"body2"}>{t("User.Signed with {{provider}}", {provider: userData.public.provider})}</Typography>
                {!userData.verified && <Typography variant={"body2"}>{t("User.Not verified")}</Typography>}
            </>}
        </Grid>}
    </Grid>
};

export default withStyles(stylesCurrent)(withStyles(styles)(ProfileComponent));
