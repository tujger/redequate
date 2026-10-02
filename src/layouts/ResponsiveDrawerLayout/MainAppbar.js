import React from "react";
import PropTypes from "prop-types";
import Menu from "@material-ui/icons/Menu";
import {Link, Route, Switch} from "react-router-dom";
import {connect} from "react-redux";
import AvatarView from "../../components/AvatarView";
import ProgressView from "../../components/ProgressView";
import {currentRole, matchRole, needAuth, Role, useCurrentUserData} from "../../controllers/UserData";
import {usePages} from "../../controllers/General";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/MainAppbar.module.css";

function MainAppbar(props) {
    const {badge, className, onHamburgerClick, label, logo} = props;
    const pages = usePages();
    const currentUserData = useCurrentUserData();
    const onPointerDown = useRippleEffect();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    return <header className={styles.appbar}>
        <div className={[styles.toolbar, className].filter(Boolean).join(" ")}>
            {onHamburgerClick
                ? <button
                    aria-label="open drawer"
                    className={styles.hamburger}
                    onClick={onHamburgerClick}
                    onPointerDown={onPointerDown}
                    type="button"
                >
                    <Menu/>
                    {badge && badge !== 0 ? <span className={styles.badge}/> : null}
                </button>
                : null}
            <h6 className={styles.title}>
                <Switch>
                    {itemsFlat.map((item, index) =>
                        <Route
                            exact={true}
                            key={index}
                            path={item._route}
                        >
                            <Link to={pages.home.route} className={styles.label} onPointerDown={onPointerDown}>
                                {logo
                                    ? <div className={styles.logo}>
                                        <img className={styles.logoImage} src={logo} alt={""}/>
                                    </div>
                                    : (label || (needAuth(item.roles, currentUserData)
                                        ? pages.login.title || pages.login.label : (matchRole(item.roles, currentUserData)
                                            ? item.title || item.label : pages.notfound.title || pages.notfound.label)))
                                }
                            </Link>
                        </Route>
                    )}
                    <Route path={pages.notfound.route}>
                        <Link to={pages.home.route} className={styles.label} onPointerDown={onPointerDown}>
                            {pages.notfound.title || pages.notfound.label}
                        </Link>
                    </Route>
                </Switch>
            </h6>
            {pages.search && <pages.search.component.type {...pages.search.component.type.props} toolbar/>}
            {currentUserData.id && <Link to={pages.profile.route} className={styles.label} onPointerDown={onPointerDown}>
                <AvatarView
                    admin={currentRole(currentUserData) === Role.ADMIN}
                    image={currentUserData.image}
                    initials={currentUserData.initials}
                    verified={currentUserData.verified}
                />
            </Link>}
        </div>
        <div className={styles.progress}>
            <ProgressView/>
        </div>
    </header>
}

MainAppbar.propTypes = {
    title: PropTypes.any,
    pages: PropTypes.object,
    onHamburgerClick: PropTypes.func
};

const mapStateToProps = ({mainAppbarReducer}) => ({
    label: mainAppbarReducer.label,
    badge: mainAppbarReducer.badge
});

export default connect(mapStateToProps)(MainAppbar);
