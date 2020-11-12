import React from "react";
import ReactGallery from "reactive-blueimp-gallery";
import "reactive-blueimp-gallery/stories/_index.css";
import withStyles from "@material-ui/styles/withStyles";
import {useHistory} from "react-router-dom";

const stylesCurrent = theme => ({
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
});

export default withStyles(stylesCurrent)((props) => {
    const {images: imagesGiven, viewer = true, classes} = props;
    const history = useHistory();
    const ref = React.useRef({})

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
                    if (ref.current) {
                        ref.current();
                        ref.current = null;
                    }
                },
                onopen: (evt) => {
                    ref.current = history.block(() => {
                        console.log("close", evt);
                        evt && evt.handleClose && evt.handleClose();
                        if (ref.current) {
                            ref.current();
                            ref.current = null;
                        }
                        return false;
                    })
                },
                youTubeClickToPlay: false
            }}
            source={images}
            withControls
        />
        {!viewer && <div className={classes._postMediaGalleryDisabled}/>}
    </>
});
