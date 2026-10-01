import React from "react";
import PropTypes from "prop-types";
import BackIcon from "@material-ui/icons/ChevronLeft";
import {Link, useHistory, useLocation} from "react-router-dom";
import AvatarView from "../../components/AvatarView";
import ProgressView from "../../components/ProgressView";
import Button from "../../controls/Button/Button";
import useRippleEffect from "../../helpers/useRippleEffect";
import {
    currentRole,
    matchRole,
    needAuth,
    Role,
    useCurrentUserData
} from "../../controllers/UserData";
import {usePages} from "../../controllers/General";
import styles from "./styles/Titlebar.module.css";

export default (props) => {
    const {className} = props;
    const pages = usePages();
    const location = useLocation();
    const history = useHistory();
    const currentUserData = useCurrentUserData();
    const onProfilePointerDown = useRippleEffect();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    const label = itemsFlat.filter(item => item.route === location.pathname).map(item => {
        return needAuth(item.roles, currentUserData)
            ? pages.login.title || pages.login.label
            : (matchRole(item.roles, currentUserData)
                ? item.title || item.label : pages.notfound.title || pages.notfound.label)
    }).filter(item => !!item)[0];

    return <header className={[styles.appbar, className].filter(Boolean).join(" ")}>
        <div className={styles.toolbar}>
            {location.pathname !== pages.home.route ?
                <Button
                    className={styles.back}
                    color={"inherit"}
                    onClick={() => {
                        history.goBack();
                    }}
                    title={"Go back"}
                    variant={"text"}
                >
                    <BackIcon/>
                    Back
                </Button> : null}
            <h6 className={styles.title}>
                {label}
            </h6>
            {currentUserData.id && <Link
                className={styles.profileLink}
                onPointerDown={onProfilePointerDown}
                to={pages.profile.route}
            >
                <AvatarView
                    admin={currentRole(currentUserData) === Role.ADMIN}
                    className={styles.avatar}
                    image={currentUserData.image}
                    initials={currentUserData.initials}
                    verified={currentUserData.verified}/>
            </Link>}
        </div>
        <ProgressView/>
    </header>
}
