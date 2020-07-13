import React, {useState} from "react";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import ClearIcon from "@material-ui/icons/Clear";
import MailIcon from "@material-ui/icons/Mail";
import EmptyAvatar from "@material-ui/icons/Person";
import {Redirect, useHistory, useParams} from "react-router-dom";
import {useCurrentUserData, UserData} from "../controllers/UserData";
import ProgressView from "../components/ProgressView";
import {useDispatch} from "react-redux";
import {refreshAll} from "../controllers/Store";
import UploadComponent, {publishFile} from "../components/UploadComponent";
import withStyles from "@material-ui/styles/withStyles";
import {notifySnackbar, useFirebase, useStore, useUserDatas} from "../controllers";
import {publicFields} from "./Profile";
import LoadingComponent from "../components/LoadingComponent";
// import AvatarEdit from "react-avatar-edit";

const styles = theme => ({
    image: {
        [theme.breakpoints.up("sm")]: {
            width: theme.spacing(18),
            height: theme.spacing(18),
        },
        [theme.breakpoints.down("sm")]: {
            width: theme.spacing(24),
            height: theme.spacing(24),
        },
        color: "darkgray",
        objectFit: "cover"
    },
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    photo: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "start"
    },
    clearPhoto: {
        backgroundColor: "transparent",
        position: "absolute",
        top: 0,
        right: 0,
        color: "white",
    },
    content: {}
});

let uppy, file, snapshot;
const EditProfile = (props) => {
    let {classes, uploadable = true, publicFields: publicFieldsGiven = publicFields, privateFields} = props;
    const dispatch = useDispatch();
    const store = useStore();
    const firebase = useFirebase();
    const history = useHistory();
    const {id} = useParams();
    const currentUserData = useCurrentUserData();
    const userDatas = useUserDatas();
    const [state, setState] = useState({
        error: null,
        disabled: false
    });

    const {state: givenState = {}} = history.location;
    const {tosuccessroute} = givenState;

    // data = givenData || data || userData;// || new UserData(firebase).fromJSON(JSON.parse(window.localStorage.getItem(history.location.pathname)));

    const {error, image, disabled, requiredError = [], userData} = state;
    uppy = state.uppy;
    file = state.file;
    snapshot = state.snapshot;

    const onerror = error => {
        setState({...state, disabled: false});
        notifySnackbar(error);
        refreshAll(store);
    };

    const requiredFilled = () => {
        const requiredError = [];
        publicFieldsGiven.forEach(field => {
            if (field.required && !state[field.id]) {
                requiredError.push(field.id);
            }
        })
        if (requiredError.length > 0) {
            setState({...state, requiredError});
            return false;
        }
        return true;
    }

    const saveUser = async () => {
        if (!requiredFilled()) return;

        setState({...state, requiredError: [], disabled: true});
        dispatch(ProgressView.SHOW);
        let publishing = {};

        if (uppy) {
            publishing = await publishFile(firebase)({
                auth: data.uid,
                uppy,
                file,
                snapshot,
                onprogress: progress => {
                    dispatch({...ProgressView.SHOW, value: progress});
                },
                defaultUrl: image,
                deleteFile: userData.public.image
            });
        }
        const {url: imageSaved, metadata} = publishing;
        dispatch(ProgressView.SHOW);

        const additionalPublic = {};
        publicFieldsGiven.forEach(field => {
            if (state[field.id]) {
                additionalPublic[field.id] = state[field.id];
            }
        })

        userData.set({
            ...additionalPublic,
            image: imageSaved || image || "",
        }).then(() => userData.savePublic())
            .then(() => userData.fetch([UserData.UPDATED, UserData.FORCE]))
            .then(() => {
                console.log("ep", userData)
                if (currentUserData.id === userData.id) {
                    dispatch({type: "currentUserData", userData});
                }
            })
            .then(() => {
                setTimeout(() => {
                    setState({...state, disabled: false, uppy: null});
                    refreshAll(store);
                    if(tosuccessroute) {
                        history.push(tosuccessroute);
                    } else {
                        history.goBack();
                    }
                }, 1000)
            }).catch(onerror).finally(() => {
            dispatch(ProgressView.HIDE);
        });
    };

    const handleUploadPhotoSuccess = ({uppy, file, snapshot}) => {
        removeUploadedFile();
        setState({...state, uppy, file, snapshot, image: snapshot.uploadURL});
    }

    const handleUploadPhotoError = (error) => {
        console.error("[EditProfile] upload", error)
        removeUploadedFile();
        setState({...state, uppy: null, file: null, snapshot: null});
    }

    const removeUploadedFile = () => {
        if (uppy && file) {
            uppy.removeFile(file.id);
            console.log("[EditProfile] file removed", snapshot);
        }
    }

    const onClose = () => {
        setState({...state, preview: null})
    }

    const onCrop = (preview) => {
        setState({...state, preview})
    }

    const onBeforeFileLoad = (elem) => {
        if (elem.target.files[0].size > 71680) {
            alert("File is too big!");
            elem.target.value = "";
        }
    }

    React.useEffect(() => {
        dispatch(ProgressView.SHOW);
        let userData;
        if(!id || id === ":id") {
            userData = currentUserData;
        } else {
            userData = userDatas[id] || new UserData(firebase).create(id);
        }
        userData.fetch([UserData.PUBLIC])
            .then(userData => userDatas[userData.id] = userData)
            .then(() => setState({...state, userData, ...userData.public}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
        return () => {
            removeUploadedFile();
        }
    }, [id])

    // if (!id) return <Redirect to={tosuccessroute}/>
    if (!userData) return <LoadingComponent/>

    return <Grid container spacing={1}>
        <Box m={0.5}/>
        <Grid item className={classes.photo}>
            <Grid container>
                {image ? <img src={image} alt="" className={classes.image}/>
                    : <EmptyAvatar className={classes.image}/>}
                <IconButton className={classes.clearPhoto} onClick={() => {
                    setState({...state, image: "", uppy: null});
                }}><ClearIcon/></IconButton>
            </Grid>
            {uploadable && <UploadComponent
                firebase={firebase}
                variant={"contained"}
                color={"primary"}
                button={<Button variant={"contained"} color={"secondary"} children={"Change"}/>}
                onsuccess={handleUploadPhotoSuccess}
                onerror={handleUploadPhotoError}
            />}
            {/*<AvatarEdit
                width={390}
                cropRadius={1}
                height={295}
                onCrop={onCrop}
                onClose={onClose}
                onBeforeFileLoad={onBeforeFileLoad}
                src={image}
            />*/}
        </Grid>
        <Grid item xs>
            <Grid container spacing={1} alignItems="flex-end">
                <Grid item>
                    <MailIcon/>
                </Grid>
                <Grid item xs>
                    <TextField
                        color={"secondary"}
                        disabled
                        fullWidth
                        label="E-mail"
                        value={userData.public.email || ""}
                    />
                </Grid>
            </Grid>
            {userData.public && publicFieldsGiven && publicFieldsGiven.map(field => {
                const editComponent = field.editComponent || <TextField/>;
                const missedRequired = requiredError.indexOf(field.id) >= 0;
                return <React.Fragment key={field.id}>
                    <Box m={1}/>
                    <Grid container spacing={1} alignItems="flex-end">
                        <Grid item>
                            {field.icon}
                        </Grid>
                        <Grid item xs>
                            <editComponent.type
                                {...editComponent.props}
                                color={"secondary"}
                                disabled={disabled}
                                error={missedRequired}
                                fullWidth
                                helperText={missedRequired ? "Please enter value" : null}
                                label={field.label}
                                onChange={ev => {
                                    setState({...state, [field.id]: ev.target.value || ""});
                                }}
                                required={field.required}
                                value={state[field.id] || ""}
                            />
                        </Grid>
                    </Grid>
                </React.Fragment>
            })}
            <Box m={1}/>
            <FormHelperText error variant={"outlined"}>
                {error}
            </FormHelperText>
            <Box m={2}/>
            <ButtonGroup variant="contained" color={"secondary"} size="large" fullWidth
                         disabled={disabled}>
                <Button onClick={saveUser}>
                    Save
                </Button>
                <Button onClick={() => history.goBack()}>
                    Cancel
                </Button>
            </ButtonGroup>
        </Grid>
    </Grid>
};

export default withStyles(styles)(EditProfile);
