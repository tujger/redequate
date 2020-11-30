import React from "react";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import {cacheDatas} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import NewPostComponent from "../NewPostComponent/NewPostComponent";
import makeStyles from "@material-ui/core/styles/makeStyles";

const stylesCurrent = makeStyles(theme => ({
    replyButton: {
        marginLeft: theme.spacing(1.5),
        padding: 0,
        textTransform: "none",
    }
}));

export default ({postData, userData, mentions, onChange, UploadProps}) => {
    const classesCurrent = stylesCurrent();

    return <Grid item>
        <NewPostComponent
            buttonComponent={<Button
                aria-label={"Reply"}
                children={"Reply"}
                className={classesCurrent.replyButton}
                component={"div"}
                size={"small"}
                title={"Reply"}
                variant={"text"}
            />}
            context={postData.id}
            mentions={mentions}
            onComplete={key => {
                console.log(key)
                cacheDatas.remove(postData.id);
                onChange();
            }}
            onError={notifySnackbar}
            replyTo={postData.id}
            text={`$[user:${postData.uid}:${userData.name}] `}
            UploadProps={UploadProps}
        />
    </Grid>
}
