import React from "react";
import Button from "@material-ui/core/Button";
import {hasWrapperControlInterface, notifySnackbar, wrapperControlCall} from "../controllers";
import useWebShare from "react-use-web-share";

const ShareComponent = ({title, text, url, component = <Button/>}) => {
    const {loading, isSupported, share} = useWebShare();
    const inputRef = React.createRef();

    const handleShare = () => {
        try {
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
        }
    }

    const handleCopy = () => {
        try {
            inputRef.current.style.display = "";
            inputRef.current.focus();
            inputRef.current.select();
            const copied = document.execCommand("copy");
            inputRef.current.style.display = "none";
            if (copied) {
                notifySnackbar("Copied to the clipboard");
            } else {
                // noinspection ExceptionCaughtLocallyJS
                throw Error("Copy to clipboard has failed");
            }
        } catch(error) {
            notifySnackbar(error);
        }
    }

    if (!(!loading && isSupported) && !hasWrapperControlInterface()) return <React.Fragment>
        <component.type
            {...component.props}
            onClick={handleCopy}
            title={title}
        />
        <input onChange={() => {}} ref={inputRef} style={{display:"none", opacity: 0, position:"fixed", top: 1, left: 1}} value={url}/>
    </React.Fragment>;

    return <component.type
        {...component.props}
        onClick={handleShare}
        title={title}
    />
};

export default ShareComponent;
