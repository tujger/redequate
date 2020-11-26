import React from "react";
import {useHistory} from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import withStyles from "@material-ui/styles/withStyles";
import {usePages} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import {stylesList} from "../../../controllers/Theme";
import {toDateString} from "../../../controllers/DateFormat";
import makeStyles from "@material-ui/core/styles/makeStyles";

const stylesCurrent = makeStyles(theme => ({
    admin: {
        borderColor: "#00ff00",
        borderStyle: "solid",
        borderWidth: 2,
    },
    disabled: {
        borderColor: "#ff0000",
        borderStyle: "solid",
        borderWidth: 2,
    },
    notVerified: {
        borderColor: "#ffff00",
        borderStyle: "solid",
        borderWidth: 2,
    },
}));

// eslint-disable-next-line react/prop-types
function UserItem({data, classes, skeleton, label}) {
    const history = useHistory();
    const pages = usePages();
    const classesCurrent = stylesCurrent();
    const {value: userData, _date} = data || {};

    if (label) return <ItemPlaceholderComponent classes={classes} label={label} flat/>
    if (skeleton) return <ItemPlaceholderComponent classes={classes} flat/>

    return <Card className={[classes.card, classes.cardFlat].join(" ")}>
        <CardActionArea
            className={classes.root}
            onClick={() => {
            history.push(pages.user.route + userData.id);
        }}>
            <CardHeader
                classes={{content: classes.cardContent}}
                className={[classes.cardHeader, classes.post].join(" ")}
                avatar={<AvatarView
                    className={[
                        classes.avatar,
                        // userData.role,
                        userData.role === "userNotVerified" ? classesCurrent.notVerified : "",
                        userData.role === "admin" ? classesCurrent.admin : "",
                        userData.role === "disabled" ? classesCurrent.disabled : "",
                    ].join(" ")}
                    image={userData.image}
                    initials={userData.initials}
                    verified={true}
                />}
                title={<Grid container>
                    <Grid item className={classes.userName}>
                        {userData.email}
                    </Grid>
                    <Grid item className={classes.date}>
                        {toDateString(_date || userData.public.created)}
                    </Grid>
                </Grid>}
                subheader={<>
                    <Grid container>
                        {userData.name}
                    </Grid>
                    <Grid container>
                        {userData.public.address}
                    </Grid>
                </>}
            />
        </CardActionArea>
    </Card>
}

export default withStyles(stylesList)(UserItem);
