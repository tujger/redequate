import React from "react";
import actionStyles from "./styles/PostActions.module.css";
import {useTranslation} from "react-i18next";
import ReplyIcon from "@material-ui/icons/ReplyOutlined";
import {cacheDatas} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import NewPostComponent from "../NewPostComponent/NewPostComponent";

export default ({icon = true, postData, mentions, onComplete, UploadProps}) => {
    const {t} = useTranslation();
    return <div className={actionStyles.action}>
        <NewPostComponent
            buttonComponent={icon
                ? <div className={actionStyles.iconButton}
                    aria-label={t("Common.Reply")}
                    children={<ReplyIcon/>}


                    title={t("Common.Reply")}
                /> : <div
                    aria-label={t("Common.Reply")}
                    children={t("Common.Reply")}
                    className={[actionStyles.button, actionStyles.replyButton].join(" ")}


                    title={t("Common.Reply")}

                />}
            context={postData.id}
            // infoComponent={<InfoComponent style={{maxHeight: 100, overflow: "auto"}}
            // >
            //     <MentionedTextComponent
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
