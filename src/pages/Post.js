import React from "react";
import {useHistory, useParams} from "react-router-dom";
import withStyles from "@material-ui/styles/withStyles";
import Grid from "@material-ui/core/Grid";
import {useDispatch} from "react-redux";
import makeStyles from "@material-ui/core/styles/makeStyles";
import AddIcon from "@material-ui/icons/Add";
import {useTranslation} from "react-i18next";
import {matchRole, useCurrentUserData} from "../controllers/UserData";
import {cacheDatas, useFirebase, usePages, useWindowData} from "../controllers/General";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import ProgressView from "../components/ProgressView";
import postItemTransform from "../components/PostComponent/postItemTransform";
import notifySnackbar from "../controllers/notifySnackbar";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import FlexFabComponent from "../components/FlexFabComponent";
import JoinUsComponent from "../components/JoinUsComponent";
import {styles} from "../controllers/Theme";
import NewPostComponent from "../components/NewPostComponent/NewPostComponent";
import PostComponent from "../components/PostComponent/PostComponent";
import NavigationToolbar from "../components/NavigationToolbar";
import LoadingComponent from "../components/LoadingComponent";

const useStyles = makeStyles(theme => ({
    card: {
    },
    cardImage: {
        marginBottom: theme.spacing(1),
        marginTop: theme.spacing(1),
        // maxHeight: "100%",
        maxWidth: "100%",
    },
    text: {
        "&:empty": {
            marginBottom: theme.spacing(1),
        },
    },
    replyButton: {
        textTransform: "none",
    }
}));

const Post = (props) => {
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const firebase = useFirebase();
    const dispatch = useDispatch();
    const {classes} = props;
    const {id, comment, reply} = useParams();
    const [state, setState] = React.useState({highlight: reply});
    const {postData, userData, highlight} = state;
    const {t} = useTranslation();
    const classesPost = useStyles();
    const type = "posts";
    const allowedExtras = ["like"];
    const pages = usePages();
    const windowData = useWindowData();

    const handleReplyChange = ({key, ...rest}) => {
        cacheDatas.remove(id);
        dispatch({type: lazyListComponentReducer.REFRESH});
        setState({...state, highlight: key});
    }

    const handlePostDelete = post => {
        history.goBack();
    }

    React.useEffect(() => {
        dispatch({type: lazyListComponentReducer.REFRESH});
        dispatch(ProgressView.SHOW);
        cacheDatas.remove(id);

        postItemTransform({
            allowedExtras,
            currentUserData,
            firebase,
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
    }, [id, postData && postData.id, comment, reply]);

    if (!postData) return <LoadingComponent/>;

    return <>
        <NavigationToolbar className={classes.top}/>
        <Grid container className={[classes.center, classesPost.center].join(" ")}>
            <PostComponent
                {...props}
                allowedExtras={allowedExtras}
                classes={{text: classesPost.text, cardImage: classesPost.cardImage}}
                className={classesPost.card}
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
        </Grid>
        {matchRole(pages.reply.roles, currentUserData) && <NewPostComponent
            buttonComponent={<FlexFabComponent
                className={classesPost.replyButton}
                icon={<AddIcon/>}
                label={t("Post.Add comment")}
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
            // text={`$[user:${postData.uid}:${userData.name}] `}
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

export default withStyles(theme => ({
    ...styles(theme),
}))(Post);
