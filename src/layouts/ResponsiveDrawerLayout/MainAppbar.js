import Menu from "@material-ui/icons/Menu";
import React from "react";
import {connect} from "react-redux";
import {Link, Route, Switch} from "react-router-dom";
import AvatarView from "../../components/AvatarView";
import ProgressView from "../../components/ProgressView";
import {usePages} from "../../controllers/General";
import {currentRole, matchRole, needAuth, Role, useCurrentUserData} from "../../controllers/UserData";
import Button from "../../controls/Button/Button";
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
                ? <Button
                    className={styles.hamburger}
                    color={"inherit"}
                    icon={<Menu/>}
                    onClick={onHamburgerClick}
                    title={"Open drawer"}
                    variant={"text"}
                >
                    {badge && badge !== 0 ? <span className={styles.badge}/> : null}
                </Button>
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
            {currentUserData.id &&
                <Link to={pages.profile.route} className={styles.label} onPointerDown={onPointerDown}>
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

const mapStateToProps = ({mainAppbarReducer}) => ({
    label: mainAppbarReducer.label,
    badge: mainAppbarReducer.badge
});

export default connect(mapStateToProps)(MainAppbar);
