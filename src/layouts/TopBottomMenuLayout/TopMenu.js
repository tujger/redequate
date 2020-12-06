import React from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/styles/withStyles";
import {currentRole, Role, useCurrentUserData} from "../../controllers/UserData";
import {Link} from "react-router-dom";
import AvatarView from "../../components/AvatarView";
import {usePages} from "../../controllers/General";
import {connect} from "react-redux";
import MenuSection from "./MenuSection";

const styles = theme => ({
    label: {
        color: "inherit",
        cursor: "default",
        textDecoration: "none",
    },
    profileitem: {
        margin: theme.spacing(0.5),
    }
});

const TopMenu = props => {
    const {badge = {}, items, classes, className} = props;
    const pages = usePages();
    const currentUserData = useCurrentUserData();

    return <div className={["MuiTopMenu-root", classes.topmenu, className].join(" ")}>
        {items.map((list, index) => <MenuSection className={classes.label} key={index} badge={badge} items={list}/>)}
        {pages.search && <pages.search.component.type {...pages.search.component.type.props} toolbar/>}
        {currentUserData.id && <Link
            to={pages.profile.route}
            className={[classes.label, classes.profileitem].join(" ")}
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

export default connect(mapStateToProps)(withStyles(styles)(TopMenu));
