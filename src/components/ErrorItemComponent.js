import React from 'react';
import {useDispatch} from "react-redux";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import CardHeader from "@material-ui/core/CardHeader";
import {styles} from "./styles";
import {UserData} from "../controllers/UserData";
import {cacheDatas, useFirebase} from "../controllers/General";
import AvatarView from "./AvatarView";
import ItemPlaceholderComponent from "./ItemPlaceholderComponent";
import {withStyles} from "@material-ui/core";
import ConfirmComponent from "./ConfirmComponent";
import {notifySnackbar, toDateString} from "../controllers";

function ErrorItemComponent(props) {
    const {data, classes, skeleton, label, onUserClick} = props;
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {alert, userData} = state;

    const handleClick = (event) => onUserClick(event, userData.id);

    React.useEffect(() => {
        if (!data || !data.value || !data.value.uid) return;
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
                avatar={<div onClick={handleClick}>
                    <AvatarView
                        image={userData.image}
                        initials={userData.name}
                        onclick={(event) => onUserClick(event, userData.id)}
                        verified={true}
                    /></div>}
                classes={{content: classes.cardContent}}
                className={[classes.cardHeader, classes.post].join(" ")}
                subheader={<React.Fragment>
                    <Grid container>
                        {data.value.error.substr(0, 100)}
                    </Grid>
                </React.Fragment>}
                title={<Grid container>
                    <Grid item className={classes.userName}>
                        <div onClickCapture={handleClick}>
                            {userData.name}
                        </div>
                    </Grid>
                    <Grid item className={classes.date}>
                        {toDateString(data.value.timestamp)}
                    </Grid></Grid>}
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
