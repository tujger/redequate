import React from "react";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import ReplyIcon from "@material-ui/icons/ReplyOutlined";
import Grid from "@material-ui/core/Grid";
import {useTranslation} from "react-i18next";
import {cacheDatas} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import NewPostComponent from "../NewPostComponent/NewPostComponent";

export default ({classes = {}, icon = true, postData, mentions, onComplete, UploadProps}) => {
    const {t} = useTranslation();
    return <Grid item>
        <NewPostComponent
            buttonComponent={icon
                ? <IconButton
                    aria-label={t("Common.Reply")}
                    children={<ReplyIcon/>}
                    component={"div"}
                    size={"small"}
                    title={t("Common.Reply")}
                /> : <Button
                    aria-label={t("Common.Reply")}
                    children={t("Common.Reply")}
                    className={classes.replyButton}
                    component={"div"}
                    size={"small"}
                    title={t("Common.Reply")}
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
                onComplete({key});
            }}
            onError={notifySnackbar}
            replyTo={postData.id}
            // text={`$[user:${postData.uid}:${userData.name}] `}
            UploadProps={UploadProps}
        />
    </Grid>
}
