import React from "react";
import ReactDOM from "react-dom";
import IconButton from "@material-ui/core/IconButton";
import TranslateIcon from "@material-ui/icons/Translate";
import Grid from "@material-ui/core/Grid";
import {useTextTranslation} from "../../controllers/textTranslation";
import {fetchDeviceId, useMetaInfo,} from "../../controllers/General";
import {useCurrentUserData} from "../../controllers/UserData";
import notifySnackbar from "../../controllers/notifySnackbar";
import MentionedTextComponent from "../MentionedTextComponent";
import {useTranslation} from "react-i18next";

export default (
    {
        ancillaryRef,
        classes,
        icon = true,
        postData,
        userData,
        mentions,
        onComplete,
        UploadProps
    }) => {
    const textTranslation = useTextTranslation();
    const [state, setState] = React.useState({});
    const {show, translated} = state;
    const metaInfo = useMetaInfo();
    const {settings} = metaInfo || {};
    const {translateLimit} = settings;
    const currentUserData = useCurrentUserData();
    const {i18n} = useTranslation();

    const handleClick = evt => {
        evt.stopPropagation();

        const fetchUserLocale = async locale => {
            if (locale && locale !== "en") return locale;
            if (currentUserData) {
                const deviceId = fetchDeviceId()
                const pvt = currentUserData.private[deviceId];
                if (!pvt) return null;
                return pvt.locale;
            }
            return null;
        }
        const fetchI18nLocale = async locale => {
            if (locale && locale !== "en") return locale;
            if (i18n) {
                return i18n.language;
            }
        }
        const fetchBrowserLocale = async locale => {
            if (locale && locale !== "en") return locale;
            const browserLocale = (navigator.language || "").toLowerCase().split("-");
            const [loc] = browserLocale;
            return loc;
        }
        const checkAvailability = async locale => {
            const available = textTranslation.isAvailable();
            if (!available) throw "Translate not available";
            return {target: locale || "en"};
        }
        const simplifyText = async props => {
            let text = postData.text;
            text = text.split(String.fromCharCode(1))[0] || "";
            text = text.replaceAll(/\$\[.*?:.*?:(.*?)]/g, "$1");
            return {...props, text};
        }
        const detectSourceLocale = async props => {
            const {text} = props;
            const source = await textTranslation.detectLanguage(text);
            return {...props, source};
        }
        const checkIfTargetSameAsSource = async props => {
            const {target, source} = props;
            if (source === target) throw "The same language";
            return props;
        }
        const translateText = async props => {
            const {target, source, text} = props;
            const {text:textTranslated, source:updatedSource = source} = await textTranslation.translateTo({
                source,
                target,
                text
            });
            if (updatedSource === target) throw "The same language";
            if(!textTranslated) throw "Not translated";
            const newtext = `Translated "${updatedSource}"->"${target}"\n${textTranslated}`;
            return {...props, translated: newtext, source: updatedSource};
        }
        const sendTranslatedToAncillaryRef = async props => {
            const {translated} = props;
            if (translated && ancillaryRef.current) {
                // ancillaryRef.current.innerHTML = translated;
                setState(state => ({...state, translated}));
                // const component = <MentionedTextComponent classes={classes} text={translated}/>;
                // const portal = ReactDOM.createPortal(component, ancillaryRef.current);
                // console.log(component, portal);
            }
            return props;
        }
        const callOnCompleteIfNeeded = async props => {
            const {translated} = props;
            if (translated && onComplete) {
                onComplete({body: translated});
            }
        }
        const catchEvent = async event => {
            if (event instanceof Error) throw event;
            console.warn(event);
            notifySnackbar(event);
        }

        fetchI18nLocale()
            .then(fetchUserLocale)
            .then(fetchBrowserLocale)
            .then(checkAvailability)
            .then(simplifyText)
            // .then(detectSourceLocale)
            // .then(checkIfTargetSameAsSource)
            .then(translateText)
            .then(sendTranslatedToAncillaryRef)
            .then(callOnCompleteIfNeeded)
            .catch(catchEvent)
            .catch(notifySnackbar);

    }

    React.useEffect(() => {
        // return;
        // console.log(textTranslation);
        if (!translateLimit) return;
        if (!textTranslation.isAvailable()) return;
        setState(state => ({...state, show: true}));

    }, [])

    if (!show) return null;
    return <>
        {translated && <Portal targetNode={ancillaryRef.current}>
            <MentionedTextComponent classes={classes} text={translated}/>
        </Portal>}
        <Grid item>
            <IconButton
                aria-label={"Translate"}
                children={<TranslateIcon/>}
                component={"div"}
                onClick={handleClick}
                size={"small"}
                title={"Translate"}
            />
        </Grid>
    </>
}

const Portal = props => {
    return ReactDOM.createPortal(props.children, props.targetNode);
}
