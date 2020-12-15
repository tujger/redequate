import React from "react";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ReplyIcon from "@material-ui/icons/ReplyOutlined";
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

export default ({icon = true, postData, userData, mentions, onChange, UploadProps}) => {
    const classesCurrent = stylesCurrent();
    return <Grid item>
        <NewPostComponent
            buttonComponent={icon ?
                <IconButton
                    aria-label={"Reply"}
                    children={<ReplyIcon/>}
                    component={"div"}
                    size={"small"}
                    title={"Reply"}
                /> : <Button
                    aria-label={"Reply"}
                    children={"Reply"}
                    className={classesCurrent.replyButton}
                    component={"div"}
                    size={"small"}
                    title={"Reply"}
                    variant={"text"}
                />}
            context={postData.id}
            // infoComponent={<InfoComponent style={{maxHeight: 100, overflow: "auto"}}
            // >
            //     <MentionedTextComponent
            //         className={classes.body}
            //         mentions={mentions}
            //         tokens={postData.tokens}
            //     />
            // </InfoComponent>}
            mentions={mentions}
            onComplete={({key}) => {
                cacheDatas.remove(postData.id);
                onChange({key});
            }}
            onError={notifySnackbar}
            replyTo={postData.id}
            // text={`$[user:${postData.uid}:${userData.name}] `}
            UploadProps={UploadProps}
        />
    </Grid>
}
