import React from "react";
// import {ConfirmComponent, getScrollPosition, useCurrentUserData, useMetaInfo, usePages} from "redequate";
import {useHistory} from "react-router-dom";
import {useCurrentUserData} from "../controllers/UserData";
import {useMetaInfo, usePages} from "../controllers/General";
import {getScrollPosition} from "../controllers/useScrollPosition";
import ConfirmComponent from "./ConfirmComponent";

const JoinUsComponent = ({label}) => {
    const [state, setState] = React.useState({});
    const {allowed, show} = state;
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const metaInfo = useMetaInfo();
    const pages = usePages();
    const {settings} = metaInfo || {};
    const {joinUsScroll, joinUsText, joinUsTimeout} = settings || {};

    const handleCancel = () => {
        window.sessionStorage.setItem("join_us_requested", new Date().getTime());
        setState(state => ({...state, allowed: false, show: false}));
    }

    const handleConfirm = () => {
        window.sessionStorage.setItem("join_us_requested", new Date().getTime());
        setState(state => ({...state, allowed: false, show: false}));
        setTimeout(() => {
            history.push(pages.login.route);
        }, 10)
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
            console.log("OUR CLIENT!")
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
        cancelLabel={"Later"}
        children={joinUsText}
        confirmLabel={"Join us"}
        confirmProps={{variant: "contained"}}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
        title={"Join us!"}
    />
}

export default JoinUsComponent;
