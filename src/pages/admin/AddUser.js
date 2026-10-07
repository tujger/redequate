import MailIcon from "@mui/icons-material/Mail";
import React from "react";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import ProgressView from "../../components/ProgressView";
import {usePages} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import {TextMaskEmail} from "../../controllers/TextMasks";
import {sendInvitationEmail} from "../../controllers/UserData";
import Button from "../../controls/Button/Button";
import TextField from "../../controls/TextField/TextField";
import baseStyles from "../../themes/Base.module.css";
import styles from "./styles/AddUser.module.css";

export default () => {
    const [state, setState] = React.useState({requesting: false, error: ""});
    const {email = "", requesting, error = ""} = state;
    const pages = usePages();
    const dispatch = useDispatch();
    const history = useHistory();

    const addUser = () => {
        if (!email) {
            setState({...state, error: "Empty e-mail."});
            return;
        }
        setState({...state, requesting: true});
        dispatch(ProgressView.SHOW);

        sendInvitationEmail(email)
            .then(() => {
                notifySnackbar("Invitation email has been sent.");
                history.push(pages.users.route);
            })
            .catch(notifySnackbar)
            .finally(() => {
                setState({...state, requesting: false});
                dispatch(ProgressView.HIDE);
            });
    };

    return <div className={baseStyles.content}>
        <div className={styles.fieldRow}>
            <MailIcon/>
            <TextField
                autoFocus
                className={styles.emailField}
                disabled={requesting}
                fullWidth
                inputComponent={TextMaskEmail}
                label={"E-mail"}
                onChange={ev => {
                    setState({...state, email: ev.target.value});
                }}
                value={email}
            />
        </div>
        <div className={styles.error} role={error ? "alert" : undefined}>
            {error}
        </div>
        <div className={styles.actions}>
            <Button
                fullWidth
                onClick={addUser}
                title={"User.Invite"}
            >
                Invite
            </Button>
            <Button
                fullWidth
                onClick={() => history.push(pages.users.route)}
                title={"Common.Cancel"}
            >
                Cancel
            </Button>
        </div>
    </div>
};
