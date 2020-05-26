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
import PhoneIcon from "@material-ui/icons/Phone";
import EmptyAvatar from "@material-ui/icons/Person";
import {Redirect, withRouter} from "react-router-dom";
import User, {updateUserPublic} from "../controllers/User";
import {TextMaskPhone} from "../controllers/TextMasks";
import ProgressView from "../components/ProgressView";
import {connect} from "react-redux";
import {refreshAll} from "../controllers/Store";
import UploadComponent, {publishFile} from "../components/UploadComponent";
import withStyles from "@material-ui/styles/withStyles";
import {notifySnackbar} from "../controllers";

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
    let {data, location = {}, history, dispatch, firebase, store, classes} = props;
    const {state:givenState = {}} = location;
    const {tosuccessroute = "/", data:givenData} = givenState;

    data = givenData || data || JSON.parse(window.localStorage.getItem(location.pathname));
    const user = User(data);

    const [state, setState] = useState({
        address: user.public().address,
        error: null,
        image: user.public().image,
        name: user.public().name,
        phone: user.public().phone,
        disabled: false
    });
    const {name = "", error = "", address = "", phone = "", image = "", disabled} = state;
    uppy = state.uppy;
    file = state.file;
    snapshot = state.snapshot;

    React.useEffect(() => {
        return () => {
            removeUploadedFile();
        }
    }, [])

    const onerror = error => {
        setState({...state, disabled: false});
        notifySnackbar(error);
        refreshAll(store);
    };

    if(!data || !data.uid) {
        return <Redirect to={tosuccessroute}/>
    }

    const saveUser = () => {
        setState({...state, disabled: true});
        dispatch(ProgressView.SHOW);
        console.log(file)
        publishFile(firebase)({uppy, file, snapshot, onprogress: progress => {
            dispatch({...ProgressView.SHOW, value:progress});
        }, defaultUrl:image}).then(({url, metadata}) => {
            dispatch(ProgressView.SHOW);
            return updateUserPublic(firebase)(data.uid, {name, address, phone, image:url})
        }).then((userData) => {
            setTimeout(() => {
                setState({...state, disabled: false});
                refreshAll(store);
                history.push(tosuccessroute, {data:userData, tosuccessroute: tosuccessroute});
            }, 1000)
        }).catch(onerror).finally(() => {
            dispatch(ProgressView.HIDE);
        });
    };

    const handleUploadPhotoSuccess = ({uppy, file, snapshot}) => {
        removeUploadedFile();
        setState({...state, uppy, file, snapshot, image:snapshot.uploadURL});
    }

    const handleUploadPhotoError = (error) => {
        console.error(error)
        removeUploadedFile();
        setState({...state, uppy: null, file: null, snapshot: null});
    }

    const removeUploadedFile = () => {
        if(uppy && file) {
            uppy.removeFile(file.id);
            console.log("file removed", snapshot);
        }
    }

    window.localStorage.setItem(location.pathname, JSON.stringify(data));

    return <Grid container spacing={1}>
        <Box m={0.5}/>
        <Grid item className={classes.photo}>
                <Grid container>
                  {image ? <img src={image} alt="" className={classes.image}/>
                    : <EmptyAvatar className={classes.image}/>}
                    <IconButton className={classes.clearPhoto} onClick={() => {
                        setState({...state, image: ""});
                    }}><ClearIcon/></IconButton>
                </Grid>
                <UploadComponent
                    firebase={firebase}
                    variant={"contained"}
                    color={"primary"}
                    button={<Button variant={"contained"} color={"primary"} children={"Change"}/>}
                    onsuccess={handleUploadPhotoSuccess}
                    onerror={handleUploadPhotoError}
                />
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
                      value={user.public().email || ""}
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
                          setState({...state, name: ev.target.value});
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
                          setState({...state, address: ev.target.value});
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
                          setState({...state, phone: ev.target.value});
                      }}
                      value={phone}
                      />
             </Grid>
          </Grid>
          <Box m={1}/>
          <FormHelperText error variant={"outlined"}>
              {error}
          </FormHelperText>
          <Box m={2}/>
          <ButtonGroup variant="contained" color="primary" size="large" fullWidth
                       disabled={disabled}
          >
              <Button
                  onClick={saveUser}
              >
                  Save
              </Button>
              <Button
                  onClick={() => history.goBack()}
              >
                  Cancel
              </Button>
          </ButtonGroup>
      </Grid>
    </Grid>
};

export default connect()(withRouter(withStyles(styles)(EditProfile)));
