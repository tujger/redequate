import MailIcon from "@mui/icons-material/Mail";
import {Box, Button, ButtonGroup, FormHelperText, Grid, TextField} from "@mui/material";
import {withStyles} from "@mui/styles";
import React from "react";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import ProgressView from "../../components/ProgressView.js";
import {usePages} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import {TextMaskEmail} from "../../controllers/TextMasks";
import {styles} from "../../controllers/Theme";
import {sendInvitationEmail} from "../../controllers/UserData";

const AddUser = ({classes}) => {
    const [state, setState] = React.useState({requesting: false, error: ""});
    const {email = "", requesting, error = ""} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const history = useHistory();

    const addUser = () => {
        if (!email) {
            setState({...state, error: "Empty e-mail"});
            return;
        }
        setState({...state, requesting: true});
        dispatch(ProgressView.SHOW);

        sendInvitationEmail(email)
            .then(() => {
                notifySnackbar("Invitation email has been sent");
                history.push(pages.users.route);
            })
            .catch(notifySnackbar)
            .finally(() => {
                setState({...state, requesting: false});
                dispatch(ProgressView.HIDE);
            });
    };

    return <Grid container className={classes.center}>
        <Box m={0.5}/>
        <Grid container spacing={1} alignItems={"flex-end"}>
            <Grid item>
                <MailIcon/>
            </Grid>
            <Grid item xs>
                <TextField
                    autoFocus={true}
                    color={"secondary"}
                    disabled={requesting}
                    label={"E-mail"}
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
        <ButtonGroup variant={"contained"} color={"secondary"} size={"large"} fullWidth>
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

export default withStyles(styles)(AddUser);
