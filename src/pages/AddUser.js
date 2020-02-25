import React, {useState} from "react";
import {Box, Button, ButtonGroup, FormHelperText, Grid, TextField} from "@material-ui/core";
import {Mail as MailIcon} from "@material-ui/icons";
import {withRouter} from "react-router-dom";
import {sendConfirmationEmail} from "../controllers/User";
import {TextMaskEmail} from "../controllers/TextMasks";
import ProgressView from "../components/ProgressView";
import {connect} from "react-redux";
import {refreshAll} from "../controllers/Store";

const AddUser = (props) => {
    const {dispatch, firebase, pages, store} = props;
    const [state, setState] = useState({requesting:false, error:""});
    const {email = "", requesting, error = ""} = state;

    const addUser = () => {
        if (!email) {
            setState({...state, error: "Empty e-mail"});
            return;
        }
        setState({...state, requesting: true});
        dispatch(ProgressView.SHOW);

        sendConfirmationEmail(firebase, store)({email: email, includeEmail: true})
          .then(() => {
              props.history.push(pages.users.route);
          })
          .catch(error => {
              setState({...state, requesting: false, error: error.message});
          })
          .finally(() => {
              refreshAll(store);
          });
    };

    return <Grid container>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems="flex-end">
            <Grid item>
                <MailIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    disabled={requesting}
                    label="E-mail"
                    fullWidth
                    InputProps={{
                        inputComponent: TextMaskEmail
                    }}
                    onChange={ev => {
                        setState({...state, email: ev.target.value});
                    }}
                    value={email}
                />
            </Grid>
        </Grid>
        <Box m={1}/>
        <FormHelperText error variant={"outlined"}>
            {error}
        </FormHelperText>
        <Box m={2}/>
        <ButtonGroup variant="contained" color="primary" size="large" fullWidth>
            <Button
                onClick={addUser}
            >
                Invite
            </Button>
            <Button
                onClick={() => props.history.push(pages.users.route)}
            >
                Cancel
            </Button>
        </ButtonGroup>
    </Grid>
};

export default connect()(withRouter(AddUser));
