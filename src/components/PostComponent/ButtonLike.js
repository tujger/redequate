import React from "react";
import {useHistory} from "react-router-dom";
import IconButton from "@material-ui/core/IconButton";
import LikeEmptyIcon from "@material-ui/icons/FavoriteBorder";
import LikeFilledIcon from "@material-ui/icons/Favorite";
import PlusIcon from "@material-ui/icons/Add";
import MinusIcon from "@material-ui/icons/Remove";
import RestoreIcon from "@material-ui/icons/Replay";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import {delay, useFirebase, usePages} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import notifySnackbar from "../../controllers/notifySnackbar";
import useTheme from "@material-ui/styles/useTheme";
import CounterComponent from "../CounterComponent";
import ProgressView from "../ProgressView";
import {useDispatch} from "react-redux";
import {Pagination} from "../../controllers";

export default ({postData, classes}) => {
    const [state, setState] = React.useState({});
    const {disabled} = state;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const theme = useTheme();
    const currentUserData = useCurrentUserData();

    const handleClickExtra = extraType => evt => {
        const prepareProcess = async () => {
            evt && evt.stopPropagation();
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true}));
        }
        const checkIfUserRegistered = async () => {
            if (!currentUserData || !currentUserData.id) {
                history.push(pages.login.route);
                throw "user not registered";
            }
        }
        const checkIfPostingAllowed = async () => {
            if (!isPostingAllowed) {
                history.push(pages.profile.route);
                throw "posting not allowed";
            }
        }
        const publishLike = async () => {
            return postData[postData.extra("like") ? "removeExtra" : "putExtra"]({type: "like", uid: currentUserData.id});
        }
        const waitTimeout = async postData => {
            await delay(1000);
            return postData;
        }
        const updateState = async postData => {
            setState(state => ({...state, postData, disabled: false}));
        }
        const catchIfThrown = async event => {
            if (event instanceof Error) throw event;
            console.log("Skipped because of", event);
        }
        const finalizeProcess = async () => {
            dispatch(ProgressView.HIDE);
            // setState(state => ({...state, disabled: false}));
        }

        prepareProcess()
            .then(checkIfUserRegistered)
            .then(checkIfPostingAllowed)
            .then(publishLike)
            .then(waitTimeout)
            .then(updateState)
            .catch(catchIfThrown)
            .catch(notifySnackbar)
            .finally(finalizeProcess)
    }

    const handlePlus = evt => {
        evt && evt.stopPropagation();
        changeCounterWithoutExtras(1)
    }

    const handleMinus = evt => {
        evt && evt.stopPropagation();
        changeCounterWithoutExtras(-1)
    }

    const changeCounterWithoutExtras = increment => {
        const prepareChanging = async () => {
            dispatch(ProgressView.SHOW);
            // setState(state => ({...state, disabled: true}));
        }
        const publishCounter = async () => {
            return firebase.database().ref("_counters").child(postData.id).child("like")
                .transaction(value => {
                    if (!value) {
                        if (increment > 0) return increment;
                        else return null;
                    } else if (value <= 0) {
                        if (increment > 0) return increment;
                        else return null;
                    } else {
                        let result = value + increment;
                        if (result <= 0) result = null;
                        return result;
                    }
                })
        }
        const updateCounter = async result => {
            const json = result.toJSON();
            const value = (json && json.snapshot) || 0;
            postData.counter("like", value);
        }
        const finalizeChanging = async () => {
            dispatch(ProgressView.HIDE);
            setState(state => ({...state, random: Math.random()}));
        }

        prepareChanging()
            .then(publishCounter)
            .then(updateCounter)
            .catch(notifySnackbar)
            .finally(finalizeChanging);
    }

    const handleRestore = evt => {
        const prepareRestoring = async () => {
            evt && evt.stopPropagation();
            dispatch(ProgressView.SHOW);
            setState(state => ({...state, disabled: true}));
        }
        const fetchExtras = async () => {
            return Pagination({
                ref: firebase.database().ref("extra"),
                child: "id",
                equals: postData.id,
                size: 10000
            }).next();
        }
        const filterLikes = async extras => {
            if (!extras) return 0;
            const likes = extras.filter(extra => extra && extra.value && extra.value.type === "like");
            return likes.length;
        }
        const publishCounter = async counter => {
            await firebase.database().ref("_counters").child(postData.id).child("like").set(counter);
            return counter;
        }
        const updateCounter = async counter => {
            postData.counter("like", counter);
        }
        const finalizeRestoring = async () => {
            dispatch(ProgressView.HIDE);
            setState(state => ({...state, disabled: false}));
        }
        prepareRestoring()
            .then(fetchExtras)
            .then(filterLikes)
            .then(publishCounter)
            .then(updateCounter)
            .catch(notifySnackbar)
            .finally(finalizeRestoring);
    }

    const isPostingAllowed = matchRole([Role.ADMIN, Role.USER], currentUserData);
    const isAdmin = matchRole([Role.ADMIN], currentUserData);
    const ancillaryStyle = {margin: 0, width: 20};

    return <Grid item>
        <IconButton
            aria-label={"Like"}
            className={classes.counter}
            component={"div"}
            onClick={handleClickExtra("like")}
            size={"small"}
            style={postData.extra("like") ? {color: theme.palette.secondary.main} : undefined}
            title={"Like"}
        >
            <CounterComponent
                // path={`${postData.id}/like`}
                counter={postData.counter("like")}
                prefix={<>
                    {postData.extra("like") ? <LikeFilledIcon/> : <LikeEmptyIcon/>}
                    <Box m={0.5}/>
                </>}
                showZero
                zeroPrefix={<><LikeEmptyIcon/><Box m={0.5}/></>}
            />
        </IconButton>
        {isAdmin && <>
            <IconButton
                aria-label={"Decrease"}
                children={<MinusIcon/>}
                className={classes.counter}
                component={"div"}
                disabled={disabled}
                onClick={handleMinus}
                size={"small"}
                style={ancillaryStyle}
                title={"Decrease"}
            />
            <IconButton
                aria-label={"Restore"}
                children={<RestoreIcon/>}
                className={classes.counter}
                component={"div"}
                disabled={disabled}
                onClick={handleRestore}
                size={"small"}
                style={ancillaryStyle}
                title={"Restore"}
            />
            <IconButton
                aria-label={"Increase"}
                children={<PlusIcon/>}
                className={classes.counter}
                component={"div"}
                disabled={disabled}
                onClick={handlePlus}
                size={"small"}
                style={ancillaryStyle}
                title={"Increase"}
            />
        </>}
    </Grid>
}
