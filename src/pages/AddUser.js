import React, {useState} from "react";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import MailIcon from "@material-ui/icons/Mail";
import {sendConfirmationEmail} from "../controllers/User";
import {TextMaskEmail} from "../controllers/TextMasks";
import ProgressView from "../components/ProgressView";
import {useDispatch} from "react-redux";
import {refreshAll} from "../controllers/Store";
import {useHistory} from "react-router-dom";
import {notifySnackbar, useFirebase, usePages, useStore} from "../controllers";

const AddUser = (props) => {
    const [state, setState] = useState({requesting: false, error: ""});
    const {email = "", requesting, error = ""} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const store = useStore();
    const firebase = useFirebase();
    const history = useHistory();

    const addUser = () => {
        if (!email) {
            setState({...state, error: "Empty e-mail"});
            return;
        }
        setState({...state, requesting: true});
        dispatch(ProgressView.SHOW);

        sendConfirmationEmail(firebase, store)({email: email, includeEmail: true})
            .then(() => {
                history.push(pages.users.route);
            })
            .catch(notifySnackbar)
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
            <Button onClick={() => history.push(pages.users.route)}>
                Cancel
            </Button>
        </ButtonGroup>
    </Grid>
};

export default AddUser;
