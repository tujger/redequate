import React from "react";
import Button from "@material-ui/core/Button";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";
import {notifySnackbar} from "../controllers/notifySnackbar";
import {firebaseMessaging} from "../controllers/Firebase";
import {useMetaInfo} from "../controllers";

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
    const metaInfo = useMetaInfo();
    const shortifyUrl = async () => {
        const domainUriPrefix = metaInfo && metaInfo.settings && metaInfo.settings.dynamicLinksUrlPrefix;
        if (domainUriPrefix) {
            return window.fetch("https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=" + (firebaseMessaging.config.apiKey), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    dynamicLinkInfo: {
                        domainUriPrefix,
                        link: url
                    },
                    suffix: {
                        option: "SHORT"
                    }
                })
            })
                .then(response => response.json())
                .then(result => {
                    if (result.error) throw result.error;
                    return result.shortLink;
                })
                .catch(error => {
                    console.error(error);
                    return url;
                })
        } else {
            console.error("'domainUriPrefix' is not defined. Define 'Dynamic links URI prefix' in 'Admin/Settings'");
            return url;
        }
    }
    const withWrapperControl = async url => {
        if (hasWrapperControlInterface()) {
            return wrapperControlCall({method: "shareText", title, text, url})
                .catch(() => {
                    throw url;
                });
        }
        throw url;
    }
    const withNavigatorShare = async url => {
        if (navigator.share) {
            return navigator.share({text, title, url})
                .catch(error => {
                    if (error.constructor.name === "DOMException") return error;
                    console.error(error)
                    if (error instanceof Error) throw url;
                    return error;
                });
        }
        throw url;
    }
    const withClipboard = async url => {
        return copyToClipboard(url);
    }

    shortifyUrl()
        .then(withWrapperControl)
        .catch(withNavigatorShare)
        .catch(withClipboard)
        .catch(error => {
            console.error(error);
        })
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
        }, 500)
        if (copied) notifySnackbar("Copied to the clipboard");
        else {
            notifySnackbar(new Error("Failed copy to clipboard"));
        }
    }

    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text)
            .then(() => notifySnackbar("Copied to the clipboard"))
            .catch(classicWay)
    } else {
        return classicWay();
    }
}
