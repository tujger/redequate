import React, {useState} from "react";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Grid from "@material-ui/core/Grid";
import InfoIcon from "@material-ui/icons/Info";
import ClearIcon from "@material-ui/icons/Clear";
import DeleteIcon from "@material-ui/icons/Clear";
import MailIcon from "@material-ui/icons/Mail";
import RoleIcon from "@material-ui/icons/Security";
import EmptyAvatar from "@material-ui/icons/Person";
import {Redirect, useHistory, useParams} from "react-router-dom";
import {matchRole, Role, sendInvitationEmail, useCurrentUserData, UserData} from "../controllers/UserData";
import ProgressView from "../components/ProgressView";
import {useDispatch} from "react-redux";
import {refreshAll} from "../controllers/Store";
import UploadComponent, {publishFile} from "../components/UploadComponent";
import withStyles from "@material-ui/styles/withStyles";
import {cacheDatas, notifySnackbar, useFirebase, usePages, useStore} from "../controllers";
import {publicFields} from "./Profile";
import LoadingComponent from "../components/LoadingComponent";
import Pagination from "../controllers/FirebasePagination";
import ConfirmComponent from "../components/ConfirmComponent";
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
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const store = useStore();
    const {id} = useParams();
    const [state, setState] = useState({
        error: null,
        disabled: false
    });

    const {state: givenState = {}} = history.location;
    const {tosuccessroute} = givenState;

    // data = givenData || data || userData;// || new UserData(firebase).fromJSON(JSON.parse(window.localStorage.getItem(history.location.pathname)));

    const {error, image, disabled, requiredError = [], uniqueError = [], userData} = state;
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
            setState(state => ({...state, requiredError}));
            return false;
        }
        return true;
    }

    const checkUnique = async () => {
        const uniqueError = [];

        for (let field of publicFieldsGiven) {
            if (field.unique) {
                const values = await new Pagination({
                    ref: firebase.database().ref("users_public"),
                    child: "name",
                    equals: state[field.id],
                }).next();
                for (let value of (values || [])) {
                    if (value.key && value.key !== userData.id) {
                        uniqueError.push(field.id);
                    }
                }
            }
        }
        if (uniqueError.length > 0) {
            setState(state => ({...state, uniqueError}));
            return false;
        }
        return true;
    }

    const saveUser = async () => {
        if (!requiredFilled()) return;

        dispatch(ProgressView.SHOW);
        setState(state => ({...state, requiredError: [], uniqueError: [], disabled: true}));
        const unique = await checkUnique();
        if (!unique) {
            setState(state => ({...state, disabled: false}));
            dispatch(ProgressView.HIDE);
            return;
        }

        let publishing = {};

        if (uppy) {
            publishing = await publishFile(firebase)({
                auth: userData.id,
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
                if (currentUserData.id === userData.id) {
                    dispatch({type: "currentUserData", userData});
                }
            })
            .then(() => {
                setTimeout(() => {
                    setState({...state, disabled: false, uppy: null});
                    refreshAll(store);
                    if (tosuccessroute) {
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

    const handleAdminAction = disabled => {
        setState({...state, disabled})
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
        if (!id || id === ":id") {
            userData = currentUserData;
        } else {
            userData = cacheDatas.put(id, UserData(firebase).create(id));
        }
        userData.fetch([UserData.PUBLIC])
            .then(() => setState({...state, userData, ...userData.public}))
            .catch(error => {
                notifySnackbar(error);
                history.goBack();
            })
            .finally(() => dispatch(ProgressView.HIDE))
        return () => {
            removeUploadedFile();
        }
    }, [id])

    // if (!id) return <Redirect to={tosuccessroute}/>
    if (!userData) return <LoadingComponent/>

    if(userData.id !== currentUserData.id && !matchRole([Role.ADMIN], currentUserData)) {
        return <Redirect to={pages.editself.route}/>
    }
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
                const uniqueRequired = uniqueError.indexOf(field.id) >= 0;
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
                                error={missedRequired || uniqueRequired}
                                fullWidth
                                helperText={missedRequired ? "Please enter value"
                                    : (uniqueRequired ? "This name is already taken" : null)}
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
            {matchRole([Role.ADMIN], currentUserData) && <EditProfileAdmin
                classes={classes}
                onAction={handleAdminAction}
                userData={userData}
            />}
        </Grid>
    </Grid>
};

export default withStyles(styles)(EditProfile);


const EditProfileAdmin = ({userData, classes, onAction}) => {
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const [state, setState] = React.useState({});
    const {disabled, role = userData.role, deleteOpen, reverifyOpen} = state;

    const saveUser = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true});
        onAction && onAction(true);

        const updates = {};
        updates[`roles/${userData.id}`] = (role === Role.USER || role === Role.USER_NOT_VERIFIED) ? null : role;
        if(role === Role.USER_NOT_VERIFIED) {
            updates[`users_public/${userData.id}/emailVerified`] = false;
        } else if(role === Role.USER || role === Role.ADMIN) {
            updates[`users_public/${userData.id}/emailVerified`] = true;
        }
        updates[`users_public/${userData.id}/updated`] = firebase.database.ServerValue.TIMESTAMP;
        firebase.database().ref().update(updates)
            .then(() => userData.fetch([UserData.ROLE, UserData.PUBLIC, UserData.FORCE]))
            .then(() => {
                console.log(userData.role, userData.verified, updates)
            })
            // .then(() => dispatch({type: LazyListComponent.RESET, cache: "users"}))
            .catch(notifySnackbar)
            .finally(() => {
                dispatch(ProgressView.HIDE);
                setState({...state, disabled: false});
                onAction && onAction(false);
            })

        // setState({...state, disabled: false});
        // onAction && onAction(false);

    }

    const handleClickDelete = () => {
        setState(state => ({...state, deleteOpen: true}));
    }

    const handleClickReverify = () => {
        setState(state => ({...state, reverifyOpen: true}));
    }

    const handleRole = (evt) => {
        setState(state => ({...state, role: evt.target.value}));
    }

    const deleteUser = () => {
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, disabled: true, deleteOpen: false}));
        onAction && onAction(true);
        console.log("delete user by admin", userData.id)

        userData.delete()
            .then(() => {
                notifySnackbar("User deleted");
                history.goBack();
            }).catch(notifySnackbar)
            .finally(() => {
                dispatch(ProgressView.HIDE);
                setState(state => ({...state, disabled: false}));
                onAction && onAction(false);
            })
    }

    const reverifyUser = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true, reverifyOpen: false});
        onAction && onAction(true);
        sendInvitationEmail(firebase)({email: userData.email})
            .catch(notifySnackbar)
            .finally(() => {
                setState(state => ({...state, disabled: false}));
                dispatch(ProgressView.HIDE);
                onAction && onAction(false);
            });
    }

    React.useEffect(() => {
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true});
        onAction && onAction(true);
        userData.fetch([UserData.ROLE, UserData.FORCE])
            .then(() => setState(state => ({...state, role: userData.role})))
            .catch(notifySnackbar)
            .finally(() => {
                console.log("[EditProfile]", userData);
                dispatch(ProgressView.HIDE);
                setState(state => ({...state, disabled: false}));
                onAction && onAction(false);
            })
    }, [userData]);

    return <React.Fragment>
        <h3>Admin only</h3>
        <Box m={1}/>
        <Grid container spacing={1} alignItems={"center"}>
            <Grid item>
                <InfoIcon/>
            </Grid>
            <Grid item xs>
                User data updated: {userData.updated}
            </Grid>
        </Grid>
        <Box m={1}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <RoleIcon/>
            </Grid>
            <Grid item xs>
                <FormControl
                    color={"secondary"}
                    disabled={disabled}
                >
                    <InputLabel
                        shrink>
                        Role
                    </InputLabel>
                    <Select
                        onChange={handleRole}
                        value={role}
                    >
                        <MenuItem value={Role.USER}>User</MenuItem>
                        <MenuItem value={Role.USER_NOT_VERIFIED}>User not verified</MenuItem>
                        <MenuItem value={Role.DISABLED}>User disabled</MenuItem>
                        <MenuItem value={Role.ADMIN}>Admin</MenuItem>
                    </Select>
                </FormControl>
            </Grid>
        </Grid>
        <Box m={2}/>
        <ButtonGroup variant="contained" color={"secondary"} size="large" fullWidth
                     disabled={disabled}>
            <Button onClick={handleClickDelete} style={{backgroundColor: "#f00", width: "auto"}}>
                <DeleteIcon/>
            </Button>
            <Button onClick={handleClickReverify} style={{width: "auto"}}>
                <MailIcon/>
            </Button>
            <Button onClick={saveUser}>
                Save
            </Button>
        </ButtonGroup>
        {deleteOpen && <ConfirmComponent
            confirmLabel={"Delete"}
            critical
            onCancel={() => setState(state => ({...state, deleteOpen: false}))}
            onConfirm={deleteUser}
            title={"Delete user data?"}
        >
            User's <b>{userData.name}</b> account and all his data will be deleted and can not be
            restored.
            <br/>
            WARNING! This action will be proceeded immediately!
        </ConfirmComponent>}
        {reverifyOpen && <ConfirmComponent
            confirmLabel={"Send"}
            onCancel={() => setState(state => ({...state, reverifyOpen: false}))}
            onConfirm={reverifyUser}
            title={"Resend verification?"}
        >
            Invitation e-mail will be sent to <b>{userData.name}</b> to allow him set up the new password if necessary.
            <br/>
            WARNING! This action will not save the user data!
        </ConfirmComponent>}
    </React.Fragment>
}
