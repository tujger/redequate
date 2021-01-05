import React from "react";
import {useHistory, useLocation, useParams} from "react-router-dom";
import withStyles from "@material-ui/styles/withStyles";
import Grid from "@material-ui/core/Grid";
import {useDispatch} from "react-redux";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {cacheDatas, useMetaInfo, usePages, useWindowData} from "../controllers/General";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import notifySnackbar from "../controllers/notifySnackbar";
import ProgressView from "../components/ProgressView";
import {uploadComponentResize} from "../components/UploadComponent/uploadComponentControls";
import LoadingComponent from "../components/LoadingComponent";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import NewPostComponent from "../components/NewPostComponent/NewPostComponent";
import {styles} from "../controllers/Theme";

const useStyles = makeStyles(theme => ({
    card: {},
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

const NewPost = (props) => {
    const dispatch = useDispatch();
    const history = useHistory();
    const location = useLocation();
    const pages = usePages();
    const {classes} = props;
    const {id, reply} = useParams();
    const [state, setState] = React.useState({highlight: reply, text: ""});
    const {imageDescriptors, text, tag, ready} = state;
    const classesPost = useStyles();
    const windowData = useWindowData();
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {uploadsAllow, uploadsMaxHeight, uploadsMaxSize, uploadsMaxWidth, uploadsQuality} = settings;

    const handleReplyChange = ({key}) => {
        cacheDatas.remove(id);
        dispatch({type: lazyListComponentReducer.REFRESH});
        history.replace(pages.post.route + key);
    }

    const handleCancelClick = evt => {
        history.goBack();
    }

    const handleError = error => {
        notifySnackbar(error)
    }

    React.useEffect(() => {
        const extractDataFromURL = async props => {
            if (location.search) {
                const search = new URLSearchParams(location.search);
                const tag = search.get("tag");
                const text = search.get("text");
                const title = search.get("title");
                const url = search.get("url");
                if (text || title || url || tag) {
                    return {...props, text, title, url, tag};
                }
            }
            return props;
        }
        const extractDataFromServiceWorker = async props => {
            dispatch(ProgressView.SHOW);
            const cachedDataFromSW = cacheDatas.get("ServiceWorkerControl");
            if (cachedDataFromSW) {
                if (cachedDataFromSW.type !== "share_target") throw "no-data";
                cacheDatas.remove("ServiceWorkerControl");
                return {...props, ...cachedDataFromSW};
            }
            return props;
        }
        const buildInitialText = async props => {
            const {title, text, url, ...rest} = props;
            let body = [];
            if (title) body.push(title);
            if (text) body.push(text);
            if (url) body.push(url);
            return {...rest, text: body.join("\n")};
        }
        const buildImageDescriptors = async props => {
            const {media} = props;
            if (media && media.length && uploadsAllow) {
                const promises = media.map(async item => {
                    const {name, size, type} = item;
                    const nameTokens = (name || "").split(".") || [];
                    const extension = (nameTokens[nameTokens.length - 1] || "").toLowerCase();
                    const descriptor = {
                        data: item,
                        extension,
                        id: "file-" + name,
                        meta: {
                            name,
                            type,
                        },
                        name,
                        size,
                        type,
                    };
                    return uploadComponentResize({
                        descriptor,
                        limits: {
                            maxWidth: uploadsMaxWidth,
                            maxHeight: uploadsMaxHeight,
                            size: uploadsMaxSize * 1024,
                            quality: uploadsQuality
                        }
                    })
                });
                const imageDescriptors = await Promise.all(promises);
                return {...props, imageDescriptors}
            }
            return props;
        }
        const updateState = async props => {
            setState(state => ({...state, ...props, ready: true}));
        }
        const catchThrown = async event => {
            if (event instanceof Error) throw event;
            console.log(event);
        }
        const finalize = async () => {
            dispatch(ProgressView.HIDE);
        }

        extractDataFromURL({})
            .then(extractDataFromServiceWorker)
            .then(buildInitialText)
            .then(buildImageDescriptors)
            .then(updateState)
            .catch(catchThrown)
            .catch(notifySnackbar)
            .finally(finalize);
    }, [location]);

    if (!ready) return <LoadingComponent/>
    return <>
        <Grid container className={[classes.center, classesPost.center].join(" ")}>
            <NewPostComponent
                buttonComponent={null}
                context={"newpost" + JSON.stringify({text, tag})}
                imageDescriptors={imageDescriptors}
                inline
                mentions={[mentionTags, mentionUsers]}
                onClose={handleCancelClick}
                onComplete={handleReplyChange}
                onError={handleError}
                tag={tag}
                text={text}
                UploadProps={{camera: !windowData.isNarrow(), multi: true}}
            />
        </Grid>
    </>
};

export default withStyles(theme => ({
    ...styles(theme),
}))(NewPost);
