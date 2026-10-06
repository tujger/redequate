import React from "react";
import actionStyles from "./styles/PostActions.module.css";
import Button from "../../controls/Button/Button";
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
                ? <Button
                    aria-label={t("Common.Reply")}
                    className={actionStyles.iconButton}
                    color={"secondary"}
                    icon={<ReplyIcon/>}
                    title={t("Common.Reply")}
                    variant={"text"}
                /> : <Button
                    aria-label={t("Common.Reply")}
                    className={[actionStyles.button, actionStyles.replyButton].join(" ")}
                    color={"secondary"}
                    variant={"text"}
                    title={t("Common.Reply")}
                >
                    {t("Common.Reply")}
                </Button>}
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
