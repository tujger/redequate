import React from "react";
import PropTypes from "prop-types";
import {connect} from "react-redux";
import {Link} from "react-router-dom";
import {
    currentRole,
    Role,
    useCurrentUserData
} from "../../controllers/UserData";
import AvatarView from "../../components/AvatarView";
import {usePages} from "../../controllers/General";
import MenuSection from "./MenuSection";
import LanguageComponent from "../../components/LanguageComponent";
import stylesTopBottomMenu from "./styles/TopBottomMenuLayout.module.css";

const TopMenu = props => {
    const {badge = {}, items, className} = props;
    const pages = usePages();
    const currentUserData = useCurrentUserData();

    return <div className={["MuiTopMenu-root", stylesTopBottomMenu.topmenu, className].join(" ")}>
        {items.map((list, index) => <MenuSection className={[stylesTopBottomMenu.label].join(" ")} key={index} badge={badge} items={list}/>)}
        <LanguageComponent className={stylesTopBottomMenu.languageChange}/>
        {pages.search && <pages.search.component.type {...pages.search.component.type.props} toolbar/>}
        {currentUserData.id && <Link
            to={pages.profile.route}
            className={[stylesTopBottomMenu.label, stylesTopBottomMenu.profileitem].join(" ")}
        >
            <AvatarView
                className={stylesTopBottomMenu.avatarSmall}
                admin={currentRole(currentUserData) === Role.ADMIN}
                image={currentUserData.image}
                initials={currentUserData.initials}
                verified={currentUserData.verified}
            />
        </Link>}
    </div>
};

TopMenu.propTypes = {
    badge: PropTypes.any,
    children: PropTypes.array,
    classes: PropTypes.any,
    className: PropTypes.string,
    items: PropTypes.array,
    pages: PropTypes.object,
};

const mapStateToProps = ({topMenuReducer}) => ({
    badge: topMenuReducer.badge,
});

export default connect(mapStateToProps)(TopMenu);
