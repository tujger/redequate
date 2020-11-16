import React from "react";
import ReactGallery from "reactive-blueimp-gallery";
import "reactive-blueimp-gallery/stories/_index.css";
import withStyles from "@material-ui/styles/withStyles";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {useHistory} from "react-router-dom";
import {useWindowData} from "../../controllers";

const stylesCurrentModal = makeStyles(theme => ({
    "@global": {
        ".react-blueimp-thumbnails": {
            position: "relative",
        },
        ".react-blueimp-thumbnails > a": {
            borderRadius: 0,
            borderWidth: 0,
            margin: 0,
            marginRight: 1,
        },
        ".react-blueimp-thumbnails > a > img": {
            objectFit: "cover",
            width: "100%",
        },
        ".blueimp-gallery > .indicator > li": {
            borderRadius: 2,
            height: 50,
            width: 50,
        }
    },
    _postMediaGalleryDisabled: {
        bottom: 0,
        left: 0,
        opacity: 0,
        position: "absolute",
        right: 0,
        top: 0,
    }
}));
const stylesCurrentInline = makeStyles(theme => ({
    "@global": {
        ".react-blueimp-thumbnails": {
            height: 0,
        },
        // ".react-blueimp-thumbnails > a": {
        //     borderRadius: 0,
        //     borderWidth: 0,
        //     margin: 0,
        //     marginRight: 1,
        // },
        // ".react-blueimp-thumbnails > a > img": {
        //     objectFit: "cover",
        //     width: "100%",
        // },
        // ".blueimp-gallery > .indicator > li": {
        //     borderRadius: 2,
        //     height: 50,
        //     width: 50,
        // }
    },
    _postMediaGalleryDisabled: {
        bottom: 0,
        left: 0,
        opacity: 0,
        position: "absolute",
        right: 0,
        top: 0,
    }
}));

export default withStyles()((props) => {
    const {images: imagesGiven, viewer = true} = props;
    const history = useHistory();
    const windowData = useWindowData();
    const ref = React.useRef({});
    const classesCurrent = /*windowData.isNarrow() ? stylesCurrentInline() : */stylesCurrentModal();

    const images = (imagesGiven || []).map(image => {
        let value = {href: image, thumbnail: image};
        try {
            if (image.match(/youtu/)) {
                const matches = image.match(/youtu.*?\?.*v=([^&]*)/);
                const id = matches[1];
                value = {
                    ...value,
                    type: "text/html",
                    "data-youtube": id,
                    thumbnail: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
                }
            }
        } catch (error) {
            console.error(error);
        }
        return value;
    })

    if (!images.length) return null;
    return <>
        <ReactGallery
            options={{
                onclosed: evt => {
                    console.log("close", evt);
                    if (ref.current) {
                        ref.current();
                        ref.current = null;
                    }
                },
                onopen: (evt) => {
                    ref.current = history.block(() => {
                        evt && evt.handleClose && evt.handleClose();
                        if (ref.current) {
                            ref.current();
                            ref.current = null;
                        }
                        return false;
                    })
                },
                youTubeClickToPlay: false,
                startSlideshow: false,
            }}
            source={images}
            withControls
        />
        {!viewer && <div className={classesCurrent._postMediaGalleryDisabled}/>}
    </>
});
