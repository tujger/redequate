import React from "react";
import {Button} from "@mui/material";
import {IconButton} from "@mui/material";
import ReplyIcon from "@mui/icons-material/ReplyOutlined";
import {Grid} from "@mui/material";
import {makeStyles} from "@mui/styles";
import {useTranslation} from "react-i18next";
import {cacheDatas} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import NewPostComponent from "../NewPostComponent/NewPostComponent";

const stylesCurrent = makeStyles(theme => ({
    replyButton: {
        marginLeft: theme.spacing(1.5),
        padding: 0,
        textTransform: "none",
    }
}));

export default ({icon = true, postData, mentions, onComplete, UploadProps}) => {
    const {t} = useTranslation();
    const classesCurrent = stylesCurrent();
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
                    className={classesCurrent.replyButton}
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
