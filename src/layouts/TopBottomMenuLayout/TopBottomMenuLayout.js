import React from "react";
import PropTypes from "prop-types";
import {useTranslation} from "react-i18next";
import BottomMenu from "./BottomMenu";
import MainContent from "../../components/MainContent";
import Snackbar from "../../components/Snackbar";
import StickyHeader from "./StickyHeader";
import TopMenu from "./TopMenu";
import {NotificationsSnackbar} from "../../controllers/Notifications";
import {enableDisabledPages, useStore} from "../../controllers/General";
import HeaderComponent from "../../components/HeaderComponent";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import {refreshAll} from "../../controllers/Store";
import notifySnackbar from "../../controllers/notifySnackbar";
import DispatchedConfirmComponent from "../../components/DispatchedConfirmComponent";
import styles from "./styles/TopBottomMenuLayout.module.css";

function TopBottomMenuLayout(props) {
    const {menu, title, footerComponent, headerComponent = <HeaderComponent/>, random, copyright} = props;
    const {t} = useTranslation();
    const currentUserData = useCurrentUserData();
    const store = useStore();
    let counter = 0;

    return <StickyHeader
        key={random}
        headerComponent={<headerComponent.type
            {...headerComponent.props}
            menuComponent={<TopMenu items={menu} className={styles.topMenu}/>}
            title={title}
            wide
        />}
    >
        <MainContent classes={{
            bottomSticky: styles.bottomSticky,
            center: styles.center,
            top: styles.top
        }}/>
        <footer className={styles.footer}>
            <BottomMenu items={menu}/>
            <div
                className={styles.version}
                onClick={event => {
                    if (!matchRole(Role.ADMIN, currentUserData)) return;
                    counter++;
                    if (counter === 3) {
                        const count = enableDisabledPages();
                        if (count) {
                            event.preventDefault();
                            refreshAll(store);
                            notifySnackbar(t(`Admin.Temporarily enabled ${count} hidden page(s)`))
                        }
                    }
                }}>
                <span className={styles.copyright}>{copyright}</span>
            </div>
        </footer>
        {footerComponent}
        <Snackbar/>
        <NotificationsSnackbar/>
        <DispatchedConfirmComponent open={false}/>
    </StickyHeader>
}

TopBottomMenuLayout.propTypes = {
    copyright: PropTypes.any,
    footerComponent: PropTypes.node,
    menu: PropTypes.array,
    headerComponent: PropTypes.element,
    random: PropTypes.any,
    title: PropTypes.any,
};

export default TopBottomMenuLayout;
