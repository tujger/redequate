import React from "react";
import {useTranslation} from "react-i18next";
import {firebaseMessaging as firebase} from "../controllers/Firebase";
import VideoIcon from "@material-ui/icons/Movie";
import AudioIcon from "@material-ui/icons/Audiotrack";
import ImageIcon from "@material-ui/icons/Image";
import AnyIcon from "@material-ui/icons/InsertDriveFile";

const fallbacks = {
    image: <ImageIcon/>,
    video: <VideoIcon/>,
    audio: <AudioIcon/>,
    any: <AnyIcon/>
}

export default ({className, title, url}) => {
    const [state, setState] = React.useState({});
    const {src = url, thumbnail = url} = state;
    const {t} = useTranslation();

    React.useEffect(() => {
        let isMount = true;
        if (url instanceof Object) return;

        const fetchFirebaseStorage = async props => {
            const {url} = props;
            try {
                const ref = firebase.storage().refFromURL(url);
                if (ref) {
                    const metadata = await ref.getMetadata();
                    return {...props, metadata};
                }
            } catch (e) {
                console.error(e);
            }
            return props;
        }
        const orParseUrl = async props => {
            const {metadata, url} = props;
            if (!metadata) {
                let metadata = {};
                if (url.indexOf("data:") === 0) {
                    const contentType = url.replace("data:", "").split(";")[0];
                    metadata = {contentType};
                }
                return {...props, metadata};
            }
            return props;
        }
        const extractContentType = async props => {
            const {metadata} = props;
            const {contentType = "application/unknown"} = metadata;
            const type = contentType.split("/")[0];
            return {...props, type};
        }
        const selectThumbnailFallback = async props => {
            const {type} = props;
            const thumbnailFallback = fallbacks[type] || fallbacks.any;
            return {...props, thumbnailFallback};
        }
        const fetchThumbnail = async props => {
            const {thumbnailFallback, type, url} = props;
            let thumbnail = url;
            if (type === "image") {

            } else {
                thumbnail = thumbnailFallback;
            }
            return {...props, thumbnail};
        }
        const updateState = async props => {
            console.log(props)
            const {thumbnail, url} = props;
            isMount && setState(state => ({...state, src: url, thumbnail}));
        }
        const catchEvent = async event => {
            console.error(event);

            isMount && setState(state => ({...state, thumbnail: fallbacks.any}));
        }

        fetchFirebaseStorage({url})
            .then(orParseUrl)
            .then(extractContentType)
            .then(selectThumbnailFallback)
            .then(fetchThumbnail)
            .then(updateState)
            .catch(catchEvent)

        return () => isMount = false;
    }, []);

    if (thumbnail instanceof Object) {
        return <thumbnail.type {...thumbnail.props} className={className} title={title}/>;
    }

    return <img
        alt={t(title || "Post.Image")}
        className={className}
        src={src}
        title={t(title || "Post.Image")}
    />
}
