import React from 'react';
import {Link} from "react-router-dom";
import {useDispatch} from "react-redux";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import Button from "@material-ui/core/Button";
import CardHeader from "@material-ui/core/CardHeader";
import {styles} from "./styles";
import {UserData} from "../controllers/UserData";
import {cacheDatas, useFirebase} from "../controllers/General";
import ProgressView from "./ProgressView";
import AvatarView from "./AvatarView";
import ItemPlaceholderComponent from "./ItemPlaceholderComponent";
import {withStyles} from "@material-ui/core";
import ConfirmComponent from "./ConfirmComponent";
import {notifySnackbar, toDateString} from "../controllers";

function ErrorItemComponent(props) {
    const {data, classes, skeleton, label, onUserClick} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {alert, userData} = state;

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
    };

    React.useEffect(() => {
        if(!data || !data.value || !data.value.uid) return;
        const userData = cacheDatas.put(data.value.uid, UserData(firebase));
        userData.fetch(data.value.uid, [UserData.NAME, UserData.IMAGE])
            .then(() => setState(state => ({...state, userData})))
            .catch(notifySnackbar)
    }, [])

    if (label) return <ItemPlaceholderComponent classes={classes} label={label}/>
    if (skeleton || !userData) return <ItemPlaceholderComponent classes={classes}/>

    return <React.Fragment>
        <CardActionArea onClick={() => {
            setState({...state, alert: true});
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
                avatar={<div onClick={(event) => onUserClick(event, userData.id)}>
                    <AvatarView
                    image={userData.image}
                    initials={userData.name}
                    onclick={(event) => onUserClick(event, userData.id)}
                    verified={true}
                    /></div>}
                title={<Grid container>
                    <Grid item className={classes.userName}>
                        <div onClickCapture={(event) => onUserClick(event, userData.id)}>
                            {userData.name}
                        </div>
                    </Grid>
                    <Grid item className={classes.date}>
                        {toDateString(data.value.timestamp)}
                    </Grid></Grid>}
                subheader={<React.Fragment>
                    <Grid container>
                        {data.value.error.substr(0, 100)}
                    </Grid>
                </React.Fragment>}
            />
        </CardActionArea>
        {alert && <ConfirmComponent
            confirmLabel={false}
            onCancel={() => setState({...state, alert: false})}
            title={"Error stacktrace"}
        >
            <pre style={{whiteSpace: "pre-wrap"}}>{data.value.error}</pre>
        </ConfirmComponent>}
    </React.Fragment>
}

export default withStyles(styles)(ErrorItemComponent);
