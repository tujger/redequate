import React from "react";
import Button from "@material-ui/core/Button";
import {hasWrapperControlInterface, notifySnackbar, wrapperControlCall} from "../controllers";
import useWebShare from "react-use-web-share";

const ShareComponent = ({title, text, url, component = <Button/>}) => {
    const {loading, isSupported, share} = useWebShare();

    const handleShare = () => {
        shareText({title, text, url});
/*        try {
            if (hasWrapperControlInterface()) {
                wrapperControlCall({method: "shareText", title, text, url})
                    .catch(notifySnackbar);
            } else {
                share({
                    text: text,
                    title: title,
                    url: url,
                })
            }
        } catch (error) {
            notifySnackbar(error);
        }*/
    }

    const handleCopy = () => {
        copyToClipboard(url);
    }

    if (!(!loading && isSupported) && !hasWrapperControlInterface()) return <React.Fragment>
        <component.type
            {...component.props}
            onClick={handleCopy}
            title={title}
        />
    </React.Fragment>;

    return <component.type
        {...component.props}
        onClick={handleShare}
        title={title}
    />
};

export default ShareComponent;

export const shareText = ({title, text, url}) => {
    // const {loading, isSupported, share} = useWebShare();
    if (!navigator.share && !hasWrapperControlInterface()) {
        copyToClipboard(url);
    } else {
        try {
            if (hasWrapperControlInterface()) {
                wrapperControlCall({method: "shareText", title, text, url})
                    .catch(notifySnackbar);
            } else {
                return navigator
                    .share({ text, title, url })
                    .catch(notifySnackbar)
                /*share({
                    text: text,
                    title: title,
                    url: url,
                })*/
            }
        } catch (error) {
            notifySnackbar(error);
        }
    }
}

export const copyToClipboard = text => {
    return navigator.clipboard.writeText(text)
        .then(() => notifySnackbar("Copied to the clipboard"))
        .catch(notifySnackbar)

    const inputNode = document.createElement("input");
    inputNode.setAttribute("style", "display:none;opacity:0;position:fixed;top:1;left:1;z-index:1000000;");
    inputNode.setAttribute("value", text);
    document.body.appendChild(inputNode);
    inputNode.style.display = "";
    inputNode.focus();
    inputNode.select();
    const copied = document.execCommand("copy");
    inputNode.style.display = "none";
    setTimeout(() => {
        document.body.removeChild(inputNode);
    }, 100)
    console.log("copied", copied, text)
    if(!copied) throw Error("Copy failed")
}
