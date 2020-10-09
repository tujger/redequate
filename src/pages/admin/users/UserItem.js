import React from "react";
import {useHistory} from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import withStyles from "@material-ui/styles/withStyles";
import {UserData} from "../../../controllers/UserData";
import {useFirebase, usePages} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import {stylesList} from "../../../controllers/Theme";

// eslint-disable-next-line react/prop-types
function UserItem({data, classes, skeleton, label}) {
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();

    if (label) return <ItemPlaceholderComponent classes={classes} label={label}/>
    if (skeleton) return <ItemPlaceholderComponent classes={classes}/>

    const userData = UserData(firebase).create(data.key, data.value);

    return <Card className={[classes.root, classes.card].join(" ")}>
        <CardActionArea onClick={() => {
            history.push(pages.user.route + userData.id);
        }}>
            <CardHeader
                classes={{content: classes.cardContent}}
                className={[classes.cardHeader, classes.post].join(" ")}
                avatar={<AvatarView
                    className={classes.avatar}
                    image={userData.image}
                    initials={userData.initials}
                    verified={userData.verified}
                />}
                title={<Grid container>
                    <Grid item className={classes.userName}>
                        {userData.email}
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
