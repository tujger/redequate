import React from "react";
import Button from "@material-ui/core/Button";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";
import {notifySnackbar} from "../controllers/notifySnackbar";
import {firebaseMessaging} from "../controllers/Firebase";

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

export function share({title = "Share", text = "Share", url: givenUrl = "", shortify = false}) {
    let url = givenUrl;
    const shortifyUrl = async () => {
        if (!shortify) return;
        firebaseMessaging.database().ref("meta/dynamicLinksUrlPrefix").once("value")
            .then(snapshot => snapshot.val())
            .then(domainUriPrefix => {
                if (!domainUriPrefix) {
                    throw Error("'domainUriPrefix' is not defined. Define 'Dynamic links URI prefix' in 'Admin/Service'");
                }
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
            })
            .then(response => response.json())
            .then(result => {
                if (result.error) throw result.error;
                console.log(result)
                if (result && result.shortLink) {
                    url = result.shortLink;
                }
            })
            .catch(console.error);
    }
    const withWrapperControl = async () => {
        if (hasWrapperControlInterface()) {
            return wrapperControlCall({method: "shareText", title, text, url})
                .catch(notifySnackbar);
        } else throw "no-wrapper-control-interface"
    }
    const withNavigatorShare = async () => {
        return navigator.share({text, title, url})
    }
    const withClipboard = async () => {
        return copyToClipboard(url);
    }

    shortifyUrl()
        .then(withWrapperControl)
        .catch(withNavigatorShare)
        .catch(withClipboard)
        .catch(notifySnackbar)
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
