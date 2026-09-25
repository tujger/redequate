import React from "react";
import {useTranslation} from "react-i18next";
import ReplyIcon from "@material-ui/icons/ReplyOutlined";
import {cacheDatas} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import NewPostComponent from "../NewPostComponent/NewPostComponent";

export default ({classes = {}, icon = true, postData, mentions, onComplete, UploadProps}) => {
    const {t} = useTranslation();
    return <div className={classes.action}>
        <NewPostComponent
            buttonComponent={icon
                ? <div className={classes.iconButton}
                    aria-label={t("Common.Reply")}
                    children={<ReplyIcon/>}


                    title={t("Common.Reply")}
                /> : <div
                    aria-label={t("Common.Reply")}
                    children={t("Common.Reply")}
                    className={[classes.button, classes.replyButton].join(" ")}


                    title={t("Common.Reply")}

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
    </div>
}
