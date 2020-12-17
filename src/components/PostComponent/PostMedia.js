import React from "react";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {useHistory} from "react-router-dom";
import SmartGallery from "react-smart-gallery";
import Lightbox from "react-image-lightbox";
import "react-image-lightbox/style.css";
import {useWindowData} from "../../controllers";
import ScrollSnapComponent from "../ScrollSnapComponent";

const stylesCurrent = makeStyles(theme => ({
    _postMediaLightboxPortal: {
        backgroundColor: "transparent",
        position: "fixed",
        zIndex: 1100,
    },
}));

const replaceCommas = symbol => {
    if (symbol === "(") return "%28";
    else if (symbol === ")") return "%29";
    return symbol;
}

export default (props) => {
    const {images: imagesGiven} = props;
    const history = useHistory();
    const ref = React.useRef({});
    const classesCurrent = stylesCurrent();
    const windowData = useWindowData();
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
                    "data-youtube": id,
                    poster: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
                    thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
                    type: "text/html",
                }
            }
        } catch (error) {
            console.error(error);
        }
        return value;
    })

    const handleClickImage = selected => evt => {
        evt && evt.stopPropagation();
        console.log(evt, selected)
        if (gallery && gallery.list && gallery.list[selected]) {
            gallery.list[selected].click();
        } else {
            setState(state => ({...state, selected}))
        }
    }

    if (!images.length) return null;

    return <>
        {!windowData.isNarrow() && <ScrollSnapComponent
            align={"start"}
            items={
                images.map((image, selected) => {
                    return <img
                        key={selected}
                        onClick={handleClickImage(selected)}
                        src={image.thumbnail}
                    />
                })
            }
        />}
        {windowData.isNarrow() && <SmartGallery
            images={images.map(image => {
                return image.href;
            })}
            onImageSelect={(evt, src, selected) => handleClickImage(selected)(evt)}
            rootStyle={{backgroundColor: "transparent"}}
            width={"100%"}
        />}
        {selected !== null && <div onClick={evt => {
            evt && evt.stopPropagation();
        }}>
            <Lightbox
                imagePadding={0}
                mainSrc={images[selected].href}
                nextSrc={images.length > 1 ? images[(selected + 1) % images.length].href : undefined}
                prevSrc={images.length > 1 ? images[(selected + images.length - 1) % images.length].href : undefined}
                onAfterOpen={() => {
                    ref.current = history.block(() => {
                        console.warn("unblock")
                        ref.current();
                        ref.current = null;
                        setState(state => ({...state, selected: null}));
                        return false;
                    })
                }}
                onCloseRequest={() => {
                    if (ref.current) {
                        ref.current();
                        ref.current = null;
                    }
                    setState(state => ({...state, selected: null}));
                }}
                onMoveNextRequest={() => {
                    setState(state => ({...state, selected: (selected + 1) % images.length}))
                }}
                onMovePrevRequest={() => {
                    setState(state => ({...state, selected: (selected + images.length - 1) % images.length}))
                }}
                reactModalProps={{portalClassName: classesCurrent._postMediaLightboxPortal}}
            />
        </div>}
    </>
};
