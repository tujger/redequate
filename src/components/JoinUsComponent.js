import React from "react";
// import {ConfirmComponent, getScrollPosition, useCurrentUserData, useMetaInfo, usePages} from "redequate";
import {useHistory} from "react-router-dom";
import {useCurrentUserData} from "../controllers/UserData";
import {useFirebase, useMetaInfo, usePages} from "../controllers/General";
import {getScrollPosition} from "../controllers/useScrollPosition";
import ConfirmComponent from "./ConfirmComponent";
import {updateActivity} from "../pages/admin/audit/auditReducer";

const JoinUsComponent = ({label}) => {
    const [state, setState] = React.useState({});
    const {allowed, show} = state;
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const history = useHistory();
    const metaInfo = useMetaInfo();
    const pages = usePages();
    const {settings} = metaInfo || {};
    const {joinUsCancel, joinUsConfirm, joinUsScroll, joinUsText, joinUsTimeout, joinUsTitle} = settings || {};

    const handleCancel = () => {
        window.sessionStorage.setItem("join_us_requested", new Date().getTime());
        setState(state => ({...state, allowed: false, show: false}));
        updateActivity({
            firebase,
            type: "Join us",
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
            firebase,
            type: "Join us",
            details: {
                action: "accepted",
                referrer: document.referrer || null
            }
        });
        window.location = pages.login.route;
    }

    React.useLayoutEffect(() => {
        const checkIfUserRegistered = async () => {
            if (currentUserData.id) throw "skip";
        }
        const checkIfSettingsAre = async () => {
            if (!joinUsTimeout && !joinUsScroll) throw "skip";
            if (!joinUsText) throw "skip";
        }
        const checkIfAlreadyRequested = async () => {
            const timestamp = +(window.sessionStorage.getItem("join_us_requested") || 0);
            const now = new Date().getTime();
            if (now - timestamp < 1000 * 60 * 60 * 24) throw "skip";
        }
        const allowRequest = async () => {
            setState(state => ({...state, allowed: true}));
        }
        const installAlertOnTimeout = async () => {
            if (joinUsTimeout) {
                setTimeout(() => {
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
            .then(checkIfSettingsAre)
            .then(checkIfAlreadyRequested)
            .then(allowRequest)
            .then(installAlertOnTimeout)
            .then(installAlertOnScroll)
            .catch(onThrowEvent)

        return () => {
            window.removeEventListener("scroll", handleScroll);
        }
    }, [])

    if (!allowed) return null;
    if (!show) return null;

    return <ConfirmComponent
        cancelLabel={joinUsCancel || null}
        cancelProps={{style: {color: "lightgray", textTransform: "none"}}}
        confirmLabel={joinUsConfirm || "Join us"}
        confirmProps={{variant: "contained", className: "MuiFab-extended"}}
        modal
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        title={joinUsTitle || "Join us!"}
    >
        {joinUsText}
    </ConfirmComponent>
}

export default JoinUsComponent;
