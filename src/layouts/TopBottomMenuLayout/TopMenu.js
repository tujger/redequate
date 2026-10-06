import React from "react";
import {connect} from "react-redux";
import {Link} from "react-router-dom";
import AvatarView from "../../components/AvatarView";
import LanguageComponent from "../../components/LanguageComponent";
import {usePages} from "../../controllers/General";
import {currentRole, Role, useCurrentUserData} from "../../controllers/UserData";
import useRippleEffect from "../../helpers/useRippleEffect";
import MenuSection from "./MenuSection";
import styles from "./styles/TopMenu.module.css";

const TopMenu = props => {
    const {badge = {}, items, className} = props;
    const pages = usePages();
    const currentUserData = useCurrentUserData();
    const onProfilePointerDown = useRippleEffect();

    return <div className={[styles.root, className].filter(Boolean).join(" ")}>
        {items.map((list, index) => <MenuSection className={styles.sectionButton} key={index} badge={badge} items={list}/>)}
        <LanguageComponent className={styles.languageChange}/>
        {pages.search && <pages.search.component.type {...pages.search.component.type.props} toolbar/>}
        {currentUserData.id && <Link
            className={styles.profileLink}
            onPointerDown={onProfilePointerDown}
            to={pages.profile.route}
        >
            <AvatarView
                admin={currentRole(currentUserData) === Role.ADMIN}
                image={currentUserData.image}
                initials={currentUserData.initials}
                size={"small"}
                verified={currentUserData.verified}
            />
        </Link>}
    </div>
};

const mapStateToProps = ({topMenuReducer}) => ({
    badge: topMenuReducer.badge,
});

export default connect(mapStateToProps)(TopMenu);
