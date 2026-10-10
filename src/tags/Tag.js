import AddIcon from "@mui/icons-material/Add";
import FixIcon from "@mui/icons-material/BugReport";
import EditIcon from "@mui/icons-material/Edit";
import ShareIcon from "@mui/icons-material/Share";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory, useParams} from "react-router-dom";
import {useBackend} from "../../packages/backend";
import FlexFabComponent from "../components/FlexFabComponent";
import InfoComponent from "../components/InfoComponent";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import LoadingComponent from "../components/LoadingComponent";
import MentionedTextComponent from "../components/MentionedTextComponent";
import ActionComponent from "../components/MutualComponent/ActionComponent";
import MutualComponent from "../components/MutualComponent/MutualComponent";
import NavigationToolbar from "../components/NavigationToolbar";
import NewPostComponent from "../components/NewPostComponent/NewPostComponent";
import PostComponent from "../components/PostComponent/PostComponent";
import postItemTransform from "../components/PostComponent/postItemTransform";
import ProgressView from "../components/ProgressView";
import ShareComponent from "../components/ShareComponent";
import Pagination from "../controllers/FirebasePagination";
import {useFirebase, usePages, useWindowData} from "../controllers/General";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import notifySnackbar from "../controllers/notifySnackbar";
import {matchRole, Role, useCurrentUserData} from "../controllers/UserData";
import Button from "../controls/Button/Button";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/Tag.module.css";

export default ({allowOwner = true}) => {
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages()
    const [state, setState] = React.useState({disabled: false});
    const {tag} = state;
    const [failedImage, setFailedImage] = React.useState(null);
    const dispatch = useDispatch();
    const db = firebase.database();
    const backend = useBackend();
    const currentUserData = useCurrentUserData();
    const windowData = useWindowData();
    const {id: itemId} = useParams();
    const {t} = useTranslation();

    const isCurrentUserAdmin = matchRole([Role.ADMIN], currentUserData);
    const isOwner = allowOwner && tag && tag.value && tag.value.uid && tag.value.uid === currentUserData.id;

    const fixErrors = () => {
        backend.callFunction("fixTag", {
            key: tag.id
        })
            .then(({result = "Complete"}) => notifySnackbar(result))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    React.useEffect(() => {
        let isMounted = true;
        dispatch(ProgressView.SHOW);
        dispatch({type: lazyListComponentReducer.RESET});
        firebase.database().ref("tag").child(itemId).once("value")
            .then(snapshot => {
                if (snapshot.exists()) return {key: snapshot.key, value: snapshot.val()};
                return Pagination({
                    ref: "tag",
                    child: "id",
                    equals: itemId,
                    size: 1
                }).next().then(items => items[0])
            })
            .then(tag => {
                const isOwner = allowOwner && tag.value.uid === currentUserData.id;
                if (tag.value.hidden && !isCurrentUserAdmin && !isOwner) {
                    history.goBack();
                } else {
                    history.replace(pages.tag.route + tag.value.id);
                    isMounted && setState(state => ({...state, tag}))
                }
            })
            .catch(error => {
                console.error(itemId, error);
                // notifySnackbar(Error(`Cannot open "${itemId}" properties`));
                history.goBack();
            })
            .finally(() => dispatch(ProgressView.HIDE))
        return () => {
            isMounted = false;
        }
        // eslint-disable-next-line
    }, [itemId]);

    if (!tag) return <LoadingComponent/>

    return <>
        <NavigationToolbar
            alignItems={"flex-end"}
            justify={"center"}
            mediumButton={<>
                {isCurrentUserAdmin && <Button
                    aria-label={t("Common.Fix possible errors")}
                    color={"secondary"}
                    icon={<FixIcon/>}
                    onClick={fixErrors}
                    title={t("Common.Fix possible errors")}
                    variant={"text"}
                />}
                {(isCurrentUserAdmin || isOwner) && <Button
                    aria-label={t("Common.Edit")}
                    color={"secondary"}
                    icon={<EditIcon/>}
                    onClick={() => history.push(pages.edittag.route + tag.key)}
                    title={t("Common.Edit")}
                    variant={"text"}
                />}
            </>}
            rightButton={<ShareComponent
                component={<Button
                    aria-label={t("Common.Share")}
                    color={"secondary"}
                    icon={<ShareIcon/>}
                    variant={"text"}
                />}
                text={t("Common.Share")}
                title={t("Common.Share")}
                url={window.location.origin + pages.tag.route + tag.value.id}
            />}
        />
        <div className={baseStyles.content}>
            <div className={styles.profile}>
                {tag.value.image && failedImage !== tag.value.image && <div className={styles.profileFieldImage}>
                    <img
                        alt={""}
                        className={styles.profileImage}
                        onError={() => setFailedImage(tag.value.image)}
                        src={tag.value.image}
                    />
                </div>}
                <div className={styles.profileFields}>
                    <div className={styles.profileField}>
                        <h6 className={styles.title}>
                            {tag.value.label} {tag.value.hidden && <>(hidden)</>}
                        </h6>
                    </div>
                    <div className={styles.profileField}>
                        <p className={styles.bodyText}>
                            <MentionedTextComponent
                                mentions={[mentionTags, mentionUsers]}
                                text={tag.value.description}
                            />
                        </p>
                    </div>
                    <div className={[styles.profileField, styles.profileActions].join(" ")}>
                        <MutualComponent
                            counterComponent={<InfoComponent suffix={"follower(s)"}/>}
                            mutualId={tag.key}
                            mutualType={"tag"}
                            typeId={"watching"}
                            subscribeComponent={<ActionComponent label={t("Tag.Follow")}/>}
                            unsubscribeComponent={<ActionComponent label={t("Tag.Unfollow")} variant={"outlined"}/>}
                            counter={false}
                            // unsubscribeComponent={<ActionComponent label={"Unfollow"}/>}
                        />
                    </div>
                </div>
            </div>
        </div>
        <div className={baseStyles.content}>
            <LazyListComponent
                itemComponent={item => <PostComponent
                    key={item.id}
                    mentions={[mentionUsers, mentionTags]}
                    postData={item}
                    userData={item._userData}
                />}
                itemTransform={postItemTransform({
                    backend,
                    fetchItemId: item => item.key,
                    onItemError: (error, options) => {
                        console.log(error, options);
                        backend.callFunction("fixMutualStamp", {
                            ...options,
                            id: options.id,
                            tag: tag.key,
                            typeId: "watching"
                        }).then(console.log)
                            .catch(console.error);
                    }
                })}
                live
                noItemsComponent={<PostComponent label={t("Tag.No posts found")}/>}
                pagination={() => new Pagination({
                    ref: db.ref("_tag").child(tag.key),
                    order: "desc",
                })}
                placeholder={<PostComponent skeleton={true}/>}
            />
        </div>
        {!tag.value.hidden && <NewPostComponent
            buttonComponent={<FlexFabComponent
                icon={<AddIcon/>}
                label={t("Post.New post")}
            />}
            context={tag.value.id}
            mentions={[mentionTags, mentionUsers]}
            onBeforePublish={async data => {
                data.text += `${String.fromCharCode(1)}$[tag:${tag.value.id}:${tag.key}]${String.fromCharCode(2)}`
                return data;
            }}
            onComplete={({key}) => {
                dispatch({type: lazyListComponentReducer.RESET});
                history.push(pages.post.route + key);
            }}
            onError={error => {
                console.error(error)
            }}
            UploadProps={windowData.isNarrow() ? {camera: false} : undefined}
        />}
    </>
};
