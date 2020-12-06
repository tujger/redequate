import React from "react";
import Button from "@material-ui/core/Button";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";
import {notifySnackbar} from "../controllers/notifySnackbar";

const ShareComponent = ({title, text, url, component = <Button/>}) => {
    const handleShare = (evt) => {
        evt && evt.stopPropagation();
        share({title, text, url});
    }

    return <component.type
        {...component.props}
        onClick={handleShare}
        title={title}
    />
};

export default ShareComponent;

export function share({title = "Share", text = "Share", url = ""}) {
    if (hasWrapperControlInterface()) {
        wrapperControlCall({method: "shareText", title, text, url})
            .catch(notifySnackbar);
    } else if (navigator.share) {
        try {
            navigator.share({text, title, url})
                .catch(notifySnackbar)
        } catch (error) {
            notifySnackbar(error);
        }
    } else {
        copyToClipboard(url);
    }
}

export async function copyToClipboard(text) {
    const classicWay = () => {
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
        if (copied) notifySnackbar("Copied to the clipboard");
        else notifySnackbar(new Error("Failed copy to clipboard"));
    }

    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text)
            .then(() => notifySnackbar("Copied to the clipboard"))
            .catch(classicWay)
            .catch(notifySnackbar)
    } else {
        return classicWay();
    }
}
