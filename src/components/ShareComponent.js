import React from "react";
import Button from "@material-ui/core/Button";
import {notifySnackbar} from "../controllers/Notifications";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";

const ShareComponent = ({title, text, url, component = <Button/>}) => {
    const handleShare = () => {
        share({title, text, url});
    }

    return <component.type
        {...component.props}
        onClick={handleShare}
        title={title}
    />
};

export default ShareComponent;

export function share({title, text, url}) {
    if (!navigator.share && !hasWrapperControlInterface()) {
        copyToClipboard(url);
    } else {
        try {
            if (hasWrapperControlInterface()) {
                wrapperControlCall({method: "shareText", title, text, url})
                    .catch(notifySnackbar);
            } else {
                navigator.share({text, title, url})
                    .catch(notifySnackbar)
            }
        } catch (error) {
            notifySnackbar(error);
        }
    }
}

export async function copyToClipboard(text) {
    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text)
            .then(() => notifySnackbar("Copied to the clipboard"))
            .catch(notifySnackbar)
    } else {
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
}
