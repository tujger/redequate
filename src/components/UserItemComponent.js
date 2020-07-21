import React from 'react';
import PropTypes from 'prop-types';
import {MoreVert} from "@material-ui/icons";
import {Link, useHistory} from "react-router-dom";
import {useDispatch} from "react-redux";
import Skeleton from "@material-ui/lab/Skeleton";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import withStyles from "@material-ui/styles/withStyles";
import {styles} from "./styles";
import {useCurrentUserData, UserData} from "../controllers/UserData";
import {notifySnackbar} from "../controllers/Notifications";
import {useFirebase, usePages} from "../controllers/General";
import {fetchCallable, fetchFunction} from "../controllers/Firebase";
import ProgressView from "./ProgressView";
import AvatarView from "./AvatarView";

export const UserPlaceholder = ({classes, label}) => (
    <Card className={classes.card}>
        <CardHeader className={classes.cardHeader}
                    avatar={<Skeleton animation={false} variant="circle"
                                      className={classes.avatar}/>}
                    title={label !== true ? label : <Skeleton animation="wave" height={12}
                                                              width="40%"
                                                              style={{marginBottom: 6}}/>}
                    subheader={!label && <React.Fragment>
                        <Skeleton animation="wave" height={12}
                                  width="100%"
                                  style={{marginBottom: 6}}/>
                        <Grid className={classes.cardActions}>
                            <Skeleton animation={false} variant="rect"
                                      width="100%" height={10}
                                      style={{marginBottom: 6}}/>
                        </Grid>
                    </React.Fragment>}
        />
    </Card>
)

function UserItemComponent(props) {
    const {data, classes, skeleton, label} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const currentUserData = useCurrentUserData();

    const [state, setState] = React.useState({});
    const {anchor} = state;

    const handleMenuClick = event => {
        event.stopPropagation();
        event.preventDefault();
        setState({...state, anchor: event.currentTarget});
    };

    const handleMenuClose = (event) => {
        event.stopPropagation();
        event.preventDefault();
        setState({...state, anchor: null});
        dispatch(ProgressView.SHOW);
        switch (event.currentTarget.id) {
            case "sendmail":
                fetchFunction(firebase)("sendMail", {
                    from: currentUserData.name + " <" + currentUserData.email + ">",
                    to: userData.email,
                    subject: "Test message",
                    message: "Test body",
                })
                    .then(() => notifySnackbar({title: "E-mail has sent"}))
                    .catch(notifySnackbar)
                    .finally(() => dispatch(ProgressView.HIDE));
                break;
            case "notify":
                fetchCallable(firebase)("sendNotification", {
                    uid: userData.id,
                    title: "Hello " + userData.name,
                    body: "Hi dude, how are you?",
                    priority: "high",
                })
                    .then(data => notifySnackbar("Sent to " + userData.name))
                    .catch(notifySnackbar)
                    .finally(() => dispatch(ProgressView.HIDE));
                break;
            default:
                dispatch(ProgressView.HIDE);
                break;
        }
    };

    if (label) return <UserPlaceholder classes={classes} label={label}/>
    if (skeleton) return <UserPlaceholder classes={classes}/>

    const userData = UserData(firebase).create(data.key, data.value);

    return <Card className={classes.card}>
        <CardActionArea onClick={() => {
            history.push(pages.user.route + userData.id);
        }}>
            <CardHeader
                classes={{content: classes.cardContent}}
                className={[classes.cardHeader, classes.post].join(" ")}
                action={null
                    /*<IconButton
                        aria-label="settings"
                        component={"div"}
                        onClickCapture={handleMenuClick}>
                        <MoreVert/>
                    </IconButton>*/
                }
                avatar={<AvatarView
                    image={userData.image}
                    initials={userData.initials}
                    verified={userData.verified}
                />}
                title={<Grid container>
                    <Grid item className={classes.userName}>
                        {userData.email}
                    </Grid>
                </Grid>}
                subheader={<React.Fragment>
                    <Grid container>
                        {userData.name}
                    </Grid>
                    <Grid container>
                        {userData.public.address}
                    </Grid>
                </React.Fragment>}
            />
        </CardActionArea>
        <Menu
            anchorEl={anchor} keepMounted
            open={Boolean(anchor)} onClose={handleMenuClose}
        >
            <Link
                to={{
                    pathname: pages.user.route + userData.id,
                }} className={classes.label}>
                <MenuItem>View</MenuItem>
            </Link>
            <Link
                to={{
                    pathname: pages.edituser.route + userData.id
                }} className={classes.label}>
                <MenuItem id={"edit"}>Edit</MenuItem>
            </Link>
            <MenuItem onClick={handleMenuClose} id={"remove"}>Remove</MenuItem>
            <MenuItem onClick={handleMenuClose} id={"sendmail"}>Send mail</MenuItem>
            {
                userData.private && Object.keys(userData.private)
                    .map(key => userData.private[key].notification)
                    .some(item => item) &&
                <MenuItem onClick={handleMenuClose} id={"notify"}>Notify</MenuItem>
            }
        </Menu>
    </Card>
}

UserItemComponent.propTypes = {
    onSwipe: PropTypes.func,
};

export default withStyles(styles)(UserItemComponent);
