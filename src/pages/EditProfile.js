import React, {useState} from "react";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import AddressIcon from "@material-ui/icons/LocationCity";
import ClearIcon from "@material-ui/icons/Clear";
import MailIcon from "@material-ui/icons/Mail";
import NameIcon from "@material-ui/icons/Person";
import EmptyAvatar from "@material-ui/icons/Person";
import PhoneIcon from "@material-ui/icons/Phone";
import {Redirect, useHistory} from "react-router-dom";
import {useCurrentUserData, UserData} from "../controllers/User";
import {TextMaskPhone} from "../controllers/TextMasks";
import ProgressView from "../components/ProgressView";
import {useDispatch} from "react-redux";
import {refreshAll} from "../controllers/Store";
import UploadComponent, {publishFile} from "../components/UploadComponent";
import withStyles from "@material-ui/styles/withStyles";
import {notifySnackbar, useFirebase, useStore} from "../controllers";
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
    let {data, classes, uploadable = true, additionalPublicFields, additionalPrivateFields} = props;
    const dispatch = useDispatch();
    const store = useStore();
    const firebase = useFirebase();
    const history = useHistory();

    const {state: givenState = {}} = history.location;
    const {tosuccessroute = "/", data: givenData} = givenState;

    const userData = useCurrentUserData();
    data = givenData || data || userData;// || new UserData(firebase).fromJSON(JSON.parse(window.localStorage.getItem(history.location.pathname)));

    const [state, setState] = useState({
        address: userData.public.address || "",
        error: null,
        image: userData.public.image || "",
        name: userData.public.name === userData.public.email ? "" : (userData.public.name || ""),
        phone: userData.public.phone || "",
        disabled: false
    });
    const {name, error, address, phone, image, disabled} = state;
    uppy = state.uppy;
    file = state.file;
    snapshot = state.snapshot;

    const onerror = error => {
        setState({...state, disabled: false});
        notifySnackbar(error);
        refreshAll(store);
    };

    const saveUser = async () => {
        setState({...state, disabled: true});
        dispatch(ProgressView.SHOW);
        let publishing = {};

        if(uppy) {
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
        const {url:imageSaved, metadata} = publishing;
        dispatch(ProgressView.SHOW);

        const additionalPublic = {};
        if(additionalPublicFields) {
            additionalPublicFields.forEach(field => {
                if(state[field.id]) {
                    additionalPublic[field.id] = state[field.id];
                }
            })
        }

        userData.set({
            ...additionalPublic,
            address,
            image: imageSaved || image || "",
            name: name,
            phone,
        }).then(() => userData.savePublic())
            .then(() => userData.fetch([UserData.UPDATED, UserData.FORCE]))
            .then(() => {
                useCurrentUserData(userData);
                dispatch({type:"currentUserData", userData:userData});
            }).then((userData) => {
            setTimeout(() => {
                setState({...state, disabled: false, uppy: null});
                refreshAll(store);
                history.push(tosuccessroute, {data: userData, tosuccessroute: tosuccessroute});
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
        if(elem.target.files[0].size > 71680){
            alert("File is too big!");
            elem.target.value = "";
        }
    }

    React.useEffect(() => {
        return () => {
            removeUploadedFile();
        }
    }, [])

    if (!data) {
        return <Redirect to={tosuccessroute}/>
    }

    window.localStorage.setItem(history.location.pathname, JSON.stringify(userData.toJSON()));

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
                button={<Button variant={"contained"} color={"primary"} children={"Change"}/>}
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
                        disabled
                        label="E-mail"
                        fullWidth
                        value={userData.public.email || ""}
                    />
                </Grid>
            </Grid>
            <Box m={1}/>
            <Grid container spacing={1} alignItems="flex-end">
                <Grid item>
                    <NameIcon/>
                </Grid>
                <Grid item xs>
                    <TextField
                        disabled={disabled}
                        label="Name"
                        fullWidth
                        onChange={ev => {
                            setState({...state, name: ev.target.value || ""});
                        }}
                        value={name}
                    />
                </Grid>
            </Grid>
            <Box m={1}/>
            <Grid container spacing={1} alignItems="flex-end">
                <Grid item>
                    <AddressIcon/>
                </Grid>
                <Grid item xs>
                    <TextField
                        disabled={disabled}
                        label="Address"
                        fullWidth
                        onChange={ev => {
                            setState({...state, address: ev.target.value || ""});
                        }}
                        value={address}
                    />
                </Grid>
            </Grid>
            <Box m={1}/>
            <Grid container spacing={1} alignItems="flex-end">
                <Grid item>
                    <PhoneIcon/>
                </Grid>
                <Grid item xs>
                    <TextField
                        disabled={disabled}
                        fullWidth
                        InputProps={{
                            inputComponent: TextMaskPhone
                        }}
                        label="Phone"
                        onChange={ev => {
                            setState({...state, phone: ev.target.value || ""});
                        }}
                        value={phone}
                    />
                </Grid>
            </Grid>
            {data.public && additionalPublicFields && additionalPublicFields.map(field => {
                return <React.Fragment key={field.id}>
                    <Box m={1}/>
                    <Grid container spacing={1} alignItems="flex-end">
                        <Grid item>
                            {field.icon}
                        </Grid>
                        <Grid item xs>
                            <field.editComponent.type
                                {...field.editComponent.props}
                                disabled={disabled}
                                fullWidth
                                label={field.label}
                                onChange={ev => {
                                    setState({...state, [field.id]: ev.target.value || ""});
                                }}
                                value={state[field.id] || data.public[field.id] || ""}
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
