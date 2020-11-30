import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ReplyIcon from "@material-ui/icons/ReplyOutlined";
import Grid from "@material-ui/core/Grid";
import {cacheDatas} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import NewPostComponent from "../NewPostComponent/NewPostComponent";

export default ({postData, userData, mentions, onChange, UploadProps}) => {
    return <Grid item>
        <NewPostComponent
            buttonComponent={<IconButton
                aria-label={"Reply"}
                children={<ReplyIcon/>}
                component={"div"}
                size={"small"}
                title={"Reply"}
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
