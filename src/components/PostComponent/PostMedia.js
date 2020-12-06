import React from "react";
// import ReactGallery from "reactive-blueimp-gallery-tt";
import withStyles from "@material-ui/styles/withStyles";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {useHistory} from "react-router-dom";
import SmartGallery from "react-smart-gallery";
import Lightbox from "react-image-lightbox";
import "react-image-lightbox/style.css";

const stylesCurrent = makeStyles(theme => ({
    _postMediaLightboxPortal: {
        backgroundColor: "transparent",
        position: "fixed",
        zIndex: 1100,
    },
    _postMediaGalleryModal: {
        "& > .carousel > .slides > .slide": {
            visibility: "visible",
        },
        "& > .controls > a": {
            fontSize: 0,
        },
        "& > .controls > .indicator > li": {
            backgroundSize: "cover",
            borderRadius: 2,
            height: 50,
            width: 50,
        },
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
    },
    _postMediaGalleryInline: {
        maxHeight: 300,
        position: "relative",
        width: "100%",
        "& > .carousel": {
            backgroundColor: "transparent",
            margin: 0,
        },
        "& > .controls > a": {
            fontSize: 0,
        },
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
    },
    _postMediaGalleryDisabled: {
        bottom: 0,
        left: 0,
        opacity: 0,
        position: "absolute",
        right: 0,
        top: 0,
    },
    _postMediaGalleryMosaic: {
        "& > .thumbnails": {
            display: "none",
        },
    }
}));

const replaceCommas = symbol => {
    if (symbol === "(") return "%28";
    else if (symbol === ")") return "%29";
    return symbol;
}

export default (props) => {
    const {images: imagesGiven, inlineCarousel = false, clickable = true, mosaic = false} = props;
    const history = useHistory();
    const ref = React.useRef({});
    const classesCurrent = stylesCurrent();
    const [state, setState] = React.useState({});
    const {selected = null, gallery} = state;

    const images = (imagesGiven || []).map(image => {
        image = image.replace(/([()])/g, replaceCommas);
        let value = {href: image, thumbnail: image};
        try {
            if (image.match(/youtu/)) {
                const matches = image.match(/youtu.*?\?.*v=([^&]*)/);
                const id = matches[1];
                value = {
                    ...value,
                    type: "text/html",
                    "data-youtube": id,
                    thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
                    poster: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
                }
            }
        } catch (error) {
            console.error(error);
        }
        return value;
    })

    if (!images.length) return null;

    return <>
        <SmartGallery
            rootStyle={{backgroundColor: "transparent"}}
            images={images.map(image => {
                return image.href;
            })}
            onImageSelect={(evt, src, selected) => {
                evt && evt.stopPropagation();
                console.log(evt, src, selected)
                if (gallery && gallery.list && gallery.list[selected]) {
                    gallery.list[selected].click();
                } else {
                    setState(state => ({...state, selected}))
                }
            }}
            width={"100%"}
        />
        {selected !== null && <Lightbox
            imagePadding={0}
            mainSrc={images[selected].href}
            nextSrc={images.length > 1 ? images[(selected + 1) % images.length].href : undefined}
            prevSrc={images.length > 1 ? images[(selected + images.length - 1) % images.length].href : undefined}
            onAfterOpen={() => {
                console.log("open", window.scrollTop)
                ref.current = history.block(() => {
                    console.log("unblock")
                    ref.current();
                    ref.current = null;
                    setState(state => ({...state, selected: null}));
                    return false;
                })
            }}
            onCloseRequest={() => {
                console.log("close", window.scrollTop)
                if (ref.current) {
                    ref.current();
                    ref.current = null;
                }
                setState(state => ({...state, selected: null}));
            }}
            onMovePrevRequest={() => {
                setState(state => ({...state, selected: (selected + images.length - 1) % images.length}))
            }}
            onMoveNextRequest={() => {
                setState(state => ({...state, selected: (selected + 1) % images.length}))
            }}
            reactModalProps={{portalClassName: classesCurrent._postMediaLightboxPortal}}
        />}
        {/*{(!mosaic || selected !== null) && <ReactGallery
            className={[
                inlineCarousel ? classesCurrent._postMediaGalleryInline : classesCurrent._postMediaGalleryModal,
                mosaic ? classesCurrent._postMediaGalleryMosaic : "",
            ].join(" ")}
            options={{
                onclosed: evt => {
                    if (!clickable || inlineCarousel) return;
                    if (ref.current) {
                        ref.current();
                        ref.current = null;
                    }
                    document.body.style.zoom = 1;
                },
                onopen: (evt) => {
                    if (!clickable || inlineCarousel) return;
                    ref.current = history.block(() => {
                        evt && evt.handleClose && evt.handleClose();
                        if (ref.current) {
                            ref.current();
                            ref.current = null;
                        }
                        if (mosaic) {
                            setState(state => ({...state, selected: null, gallery: null}));
                        }
                        return false;
                    })
                },
                onslide: (index, slide) => {
                    if (images[index] && images[index]["data-youtube"]) {
                        try {
                            const button = slide.getElementsByTagName("a")[0];
                            button.addEventListener("click", event => {
                                slide.firstChild.classList.add("video-playing");
                            }, {once: true});
                        } catch (e) {
                            console.error(e);
                        }
                    }
                },
                emulateTouchEvents: true,
                youTubeClickToPlay: true,
                startSlideshow: false,
            }}
            inlineCarousel={inlineCarousel}
            onrender={slides => {
                if (mosaic && slides.childNodes[selected]) {
                    slides.childNodes[selected].click();
                }
            }}
            oninit={evt => {
                setState(state => ({...state, gallery: evt}));
            }}
            source={images}
            withControls={inlineCarousel}
        />}
        {!mosaic && !clickable && <div className={classesCurrent._postMediaGalleryDisabled}/>}*/}
    </>
};
