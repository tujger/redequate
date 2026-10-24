import BackIcon from "@mui/icons-material/ChevronLeft";
import React from "react";
import {Link, useHistory, useLocation} from "react-router-dom";
import AvatarView from "../../components/AvatarView";
import ProgressView from "../../components/ProgressView";
import {usePages} from "../../controllers/General";
import {currentRole, matchRole, needAuth, UserRole} from "../../controllers/UserData";
import {useCurrentUserDataValue} from "../../controllers/useCurrentUserData";
import Button from "../../controls/Button/Button";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/Titlebar.module.css";

export default (props) => {
    const {className} = props;
    const currentUserData = useCurrentUserDataValue();
    const history = useHistory();
    const location = useLocation();
    const pages = usePages();
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
                    admin={currentRole(currentUserData) === UserRole.ADMIN}
                    className={styles.avatar}
                    image={currentUserData.image}
                    initials={currentUserData.initials}
                    verified={currentUserData.verified}/>
            </Link>}
        </div>
        <ProgressView/>
    </header>
}
