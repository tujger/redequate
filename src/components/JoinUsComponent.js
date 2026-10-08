import React from "react";
import {useTranslation} from "react-i18next";
import {useHistory} from "react-router-dom";
import {useMetaInfo, usePages, useStore} from "../controllers/General";
import {useCurrentUserData} from "../controllers/UserData";
import {getScrollPosition} from "../helpers/useScrollPosition";
import {updateActivity} from "../pages/admin/audit/auditReducer";
import ConfirmComponent from "./ConfirmComponent";

let identityScriptPromise;
const loadGoogleIdentity = () => {
    if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
    if (!identityScriptPromise) identityScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.onload = () => resolve(window.google.accounts.id);
        script.onerror = () => {
            script.remove();
            identityScriptPromise = undefined;
            reject(new Error("Cannot load Google Identity Services"));
        };
        document.head.appendChild(script);
    });
    return identityScriptPromise;
};

const JoinUsComponent = ({oneTap = true, joinUs = true}) => {
    const [state, setState] = React.useState({});
    const {allowed, show} = state;
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const metaInfo = useMetaInfo();
    const pages = usePages();
    const store = useStore();
    const {settings} = metaInfo || {};
    const {
        joinUsCancel,
        joinUsConfirm,
        joinUsScroll,
        joinUsText,
        joinUsTimeout,
        joinUsTitle,
        oneTapCliendId
    } = settings || {};
    const {t} = useTranslation();

    const handleCancel = () => {
        window.sessionStorage.setItem("join_us_requested", new Date().getTime());
        setState(state => ({...state, allowed: false, show: false}));
        updateActivity({
            type: t("JoinUs.Join us"),
            details: {
                action: "rejected",
                referrer: document.referrer || null
            }
        });
    }

    const handleConfirm = () => {
        window.sessionStorage.setItem("join_us_requested", new Date().getTime());
        setState(state => ({...state, allowed: false, show: false}));
        updateActivity({
            type: t("JoinUs.Join us"),
            details: {
                action: "accepted",
                referrer: document.referrer || null
            }
        });
        window.location = pages.signup.route;
    }

    React.useLayoutEffect(() => {
        let active = true;
        let promptStarted = false;
        let timeout;
        const checkIfUserRegistered = async () => {
            if (currentUserData.id) throw "skip";
        }
        const tryWithOneTap = async () => new Promise((resolve, reject) => {
            if (!active) return reject("skip");
            if (!oneTapCliendId || !oneTap) return resolve();
            loadGoogleIdentity().then(identity => {
                if (!active) return reject("skip");
                identity.initialize({
                    client_id: oneTapCliendId,
                    use_fedcm_for_prompt: true,
                    callback: props => {
                        if (!active) return;
                        reject("skip");
                        history.push(pages.login.route, {
                            loginWith: "token",
                            credential: props.credential
                        });
                    }
                });
                promptStarted = true;
                identity.prompt(notification => {
                    if (!active) return reject("skip");
                    if (notification.isSkippedMoment()) resolve();
                    else if (notification.isDismissedMoment()) reject("skip");
                });
            }).catch(error => {
                if (active) console.error(error);
                resolve();
            });
        })
        const checkIfSettingsAre = async () => {
            if (!joinUs) throw "skip";
            if (!joinUsTimeout && !joinUsScroll) throw "skip";
            if (!joinUsText) throw "skip";
        }
        const checkIfAlreadyRequested = async () => {
            const timestamp = +(window.sessionStorage.getItem("join_us_requested") || 0);
            const now = new Date().getTime();
            if (now - timestamp < 1000 * 60 * 60 * 24) throw "skip";
        }
        const allowRequest = async () => {
            if (!active) throw "skip";
            setState(state => ({...state, allowed: true}));
        }
        const installAlertOnTimeout = async () => {
            if (joinUsTimeout) {
                timeout = setTimeout(() => {
                    setState(state => ({...state, show: true}));
                }, +(joinUsTimeout * 1000));
            }
        }
        const handleScroll = evt => {
            const position = getScrollPosition({});
            if (position && position.y < -(+joinUsScroll)) {
                setState(state => ({...state, show: true}));
                window.removeEventListener("scroll", handleScroll);
            }
        }
        const installAlertOnScroll = async () => {
            if (joinUsScroll) {
                window.addEventListener("scroll", handleScroll)
            }
        }
        const onThrowEvent = async event => {
            if (event === "skip") return;
            console.error("[JoinUsComponent]", event);
        }

        checkIfUserRegistered()
            .then(tryWithOneTap)
            .then(checkIfSettingsAre)
            .then(checkIfAlreadyRequested)
            .then(allowRequest)
            .then(installAlertOnTimeout)
            .then(installAlertOnScroll)
            .catch(onThrowEvent)

        return () => {
            active = false;
            clearTimeout(timeout);
            if (promptStarted) window.google?.accounts?.id.cancel();
            window.removeEventListener("scroll", handleScroll);
        }
    }, [])

    if (!allowed) return null;
    if (!show) return null;

    return <ConfirmComponent
        cancelLabel={joinUsCancel || null}
        cancelProps={{style: {color: "lightgray", textTransform: "none"}}}
        confirmLabel={joinUsConfirm || t("JoinUs.Join us")}
        confirmProps={{variant: "contained", className: "MuiFab-extended"}}
        modal
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        title={joinUsTitle || t("JoinUs.Join us")}
    >
        {joinUsText}
    </ConfirmComponent>
}

export default JoinUsComponent;
