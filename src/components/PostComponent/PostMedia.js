import React from "react";
import ReactGallery from "reactive-blueimp-gallery-t";
import withStyles from "@material-ui/styles/withStyles";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {useHistory} from "react-router-dom";

const stylesCurrentModal = makeStyles(theme => ({
    _postMediaGallery: {
        "& > .thumbnails": {
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",

            position: "relative",
        },
        "& > .thumbnails > a": {
            borderWidth: 0,
            borderRadius: 0,
            height: 150,
            margin: 0,
            marginRight: 1,
            overflow: "hidden",
            width: 150,
        },
        "& > .thumbnails > a > img": {
            height: "100%",
            verticalAlign: "middle",
            textAlign: "center",

            objectFit: "cover",
            width: "100%",
        },
        "& > .controls > .indicator > li": {
            borderRadius: 2,
            height: 50,
            width: 50,
        },
        "& > .carousel > .slides > .slide": {
            visibility: ""
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
    _postMediaGallery: {
        maxHeight: 300,
        position: "relative",
        width: "100%",
        "& > .thumbnails": {
            display: "none",
            flexDirection: "row",
            justifyContent: "center",
        },
        "& > .thumbnails > a": {
            border: "1px solid #aaa",
            borderRadius: 5,
            margin: 5,
            height: 100,
            width: 100,
            overflow: "hidden",
        },
        "& > .thumbnails > a > img": {
            height: "100%",
            verticalAlign: "middle",
            textAlign: "center",
        },
        "& > .carousel": {
            backgroundColor: "transparent",
            margin: 0,
        },
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
    const {images: imagesGiven, inlineCarousel = false, clickable = true} = props;
    const history = useHistory();
    const ref = React.useRef({});
    const classesCurrent = inlineCarousel ? stylesCurrentInline() : stylesCurrentModal();

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
            className={classesCurrent._postMediaGallery}
            options={{
                onclosed: evt => {
                    if (!clickable || inlineCarousel) return;
                    console.log("close", evt);
                    if (ref.current) {
                        ref.current();
                        ref.current = null;
                    }
                },
                onopen: (evt) => {
                    if (!clickable || inlineCarousel) return;
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
            inlineCarousel={inlineCarousel}
            source={images}
        />
        {!clickable && <div className={classesCurrent._postMediaGalleryDisabled}/>}
    </>
});
