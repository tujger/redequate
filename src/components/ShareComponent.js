import React from "react";
import Button from "@material-ui/core/Button";
import {hasWrapperControlInterface, notifySnackbar, wrapperControlCall} from "../controllers";
import useWebShare from "react-use-web-share";

const ShareComponent = ({title, text, url, component = <Button/>}) => {
    const {loading, isSupported, share} = useWebShare();

    const handleShare = () => {
        try {
            if (hasWrapperControlInterface()) {
                wrapperControlCall({method: "shareText", title, text, url})
                    .catch(notifySnackbar);
            } else {
                try {
                    share({
                        text: text,
                        title: title,
                        url: url,
                    })
                } catch (error) {
                    notifySnackbar(error);
                }
            }
        } catch (error) {
            notifySnackbar(error);
        }
    }

    if (!(!loading && isSupported) && !hasWrapperControlInterface()) return null;
    return <component.type
        {...component.props}
        onClick={handleShare}
    />
};

export default ShareComponent;
