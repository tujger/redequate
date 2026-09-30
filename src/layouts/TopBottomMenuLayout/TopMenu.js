import React from "react";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {Link} from "react-router-dom";
import {currentRole, Role, useCurrentUserData} from "../../controllers/UserData";
import AvatarView from "../../components/AvatarView";
import {usePages} from "../../controllers/General";
import useRippleEffect from "../../helpers/useRippleEffect";
import MenuSection from "./MenuSection";
import LanguageComponent from "../../components/LanguageComponent";
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
                verified={currentUserData.verified}
            />
        </Link>}
    </div>
};

TopMenu.propTypes = {
    badge: PropTypes.object,
    className: PropTypes.string,
    items: PropTypes.array,
};

const mapStateToProps = ({topMenuReducer}) => ({
    badge: topMenuReducer.badge,
});

export default connect(mapStateToProps)(TopMenu);
