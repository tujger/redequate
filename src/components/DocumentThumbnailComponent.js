import AudioIcon from "@mui/icons-material/Audiotrack";
import ImageIcon from "@mui/icons-material/Image";
import AnyIcon from "@mui/icons-material/InsertDriveFile";
import VideoIcon from "@mui/icons-material/Movie";
import React from "react";
import {useTranslation} from "react-i18next";
import {useStorage} from "../../storage";

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
    const storage = useStorage();

    React.useEffect(() => {
        let isMount = true;
        if (url instanceof Object) return;

        const parseUrl = async props => {
            const {metadata, url} = props;
            if (!metadata) {
                if (url.indexOf("data:") === 0) {
                    const contentType = url.replace("data:", "").split(";")[0];
                    const metadata = {contentType};
                    return {...props, metadata};
                }
            }
            return props;
        }
        const orFetchStorage = async props => {
            const {metadata, url} = props;
            if (!metadata) {
                try {
                    const metadata = await storage.resolveMetadata(url);
                    return {...props, metadata};
                } catch (e) {
                    console.error(e);
                }
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

        parseUrl({url})
            .then(orFetchStorage)
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
