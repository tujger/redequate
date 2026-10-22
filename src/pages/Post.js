import AddIcon from "@mui/icons-material/Add";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory, useParams} from "react-router-dom";
import FlexFabComponent from "../components/FlexFabComponent";
import JoinUsComponent from "../components/JoinUsComponent";
import LoadingComponent from "../components/LoadingComponent";
import NavigationToolbar from "../components/NavigationToolbar";
import NewPostComponent from "../components/NewPostComponent/NewPostComponent";
import PostComponent from "../components/PostComponent/PostComponent";
import postItemTransform from "../components/PostComponent/postItemTransform";
import ProgressView from "../components/ProgressView";
import {useAuth, useBackend, useDatabase} from "../controllers";
import {cacheDatas, usePages, useWindowData, Layout} from "../controllers/General";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import notifySnackbar from "../controllers/notifySnackbar";
import {matchRole} from "../controllers/UserData";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/Post.module.css";

export default (props) => {
    const auth = useAuth();
    const backend = useBackend();
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
    const history = useHistory();
    const {id, comment, reply} = useParams();
    const [state, setState] = React.useState({highlight: reply});
    const {t} = useTranslation();
    const windowData = useWindowData();

    const {postData, userData, highlight} = state;
    const type = "posts";
    const allowedExtras = ["like"];
    const pages = usePages();

    const handleReplyChange = ({key, ...rest}) => {
        cacheDatas.remove(id);
        dispatch({type: Layout.REFRESH});
        setState({...state, highlight: key});
    }

    const handlePostDelete = post => {
        history.goBack();
    }

    React.useEffect(() => {
        dispatch(ProgressView.SHOW);
        cacheDatas.remove(id);

        postItemTransform({
            allowedExtras,
            backend,
            currentUserData,
            database,
            onItemError: error => {
                throw error;
            },
            type,
        })({key: id})
            .then(postData => setState(state => ({
                ...state,
                postData,
                userData: postData && postData._userData
            })))
            .catch(error => {
                notifySnackbar(error);
                history.goBack();
            })
            .finally(() => dispatch(ProgressView.HIDE))
        // eslint-disable-next-line
    }, [id, postData && postData.id, comment, reply, currentUserData]);

    if (!postData) return <LoadingComponent/>;

    return <>
        <NavigationToolbar/>
        <div className={baseStyles.content}>
            <PostComponent
                {...props}
                allowedExtras={allowedExtras}
                className={styles.post}
                collapsible={false}
                disableClick={true}
                expand={comment}
                highlight={highlight}
                mentions={[mentionUsers, mentionTags]}
                onChange={handleReplyChange}
                onDelete={handlePostDelete}
                // pattern={"bordered"}
                postData={postData}
                level={0}
                type={type}
                UploadProps={{camera: !windowData.isNarrow(), multi: true}}
                userData={userData}
            />
        </div>
        {matchRole(pages.reply.roles, currentUserData) && <NewPostComponent
            buttonComponent={<FlexFabComponent
                icon={<AddIcon/>}
                label={t("Post.Add comment")}
            />}
            context={postData.id}
            mentions={[mentionTags, mentionUsers]}
            onComplete={handleReplyChange}
            onError={notifySnackbar}
            replyTo={postData.id}
            roles={pages.reply.roles}
            UploadProps={{camera: !windowData.isNarrow(), multi: true}}
        />}
        <JoinUsComponent/>
    </>
};
