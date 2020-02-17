import React, {useState} from "react";
import {Box, Button, ButtonGroup, FormHelperText, Grid, TextField} from "@material-ui/core";
import {
  LocationCity as AddressIcon,
  Mail as MailIcon,
  Person as NameIcon,
  Phone as PhoneIcon
} from "@material-ui/icons";
import {Redirect, withRouter} from "react-router-dom";
import {fetchUser, updateUser} from "../controllers/User";
import {TextMaskPhone} from "../controllers/TextMasks";
import ProgressView from "../components/ProgressView";
import {connect} from "react-redux";
import {refreshAll} from "../controllers/Store";

const EditProfile = (props) => {
    let {data, location = {}, history, dispatch, firebase, store} = props;
    const {state:givenState = {}} = location;
    const {tosuccessroute, data:givenData} = givenState;

    data = givenData || data || JSON.parse(window.localStorage.getItem(location.pathname));

    const [state, setState] = useState({
        address: data ? data.address || "" : "",
        error:"",
        image: data ? data.image || "" : "",
        name: data ? data.name || "" : "",
        phone: data ? data.phone || "" : "",
        disabled: false
    });
    const {name = "", error = "", address = "", phone = "", image = "", disabled} = state;

    const onerror = error => {
        setState({...state, disabled: false});
        refreshAll(store);
    };

    const saveUser = () => {
        setState({...state, disabled: true});
        dispatch(ProgressView.SHOW);
        fetchUser(firebase)(data.uid, user => {
            updateUser(firebase)({...user, name, address, phone, image}, (user) => {
                setTimeout(() => {
                    setState({...state, disabled: false});
                    refreshAll(store);
                    history.push(tosuccessroute, {data:user, tosuccessroute: tosuccessroute});
                }, 1000)
            }, onerror);
        }, onerror);
    };

    if(!data) {
        return <Redirect to={tosuccessroute}/>
    }

    window.localStorage.setItem(location.pathname, JSON.stringify(data));

    return <Grid container>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <MailIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    disabled
                    label="E-mail"
                    fullWidth
                    value={data.email}
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
};

export default connect()(withRouter(EditProfile));
