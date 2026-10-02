import React from "react";
import {useTranslation} from "react-i18next";
import DispatchedConfirmComponent from "../../components/DispatchedConfirmComponent";
import HeaderComponent from "../../components/HeaderComponent";
import MainContent from "../../components/MainContent";
import Snackbar from "../../components/Snackbar";
import {enableDisabledPages, useStore} from "../../controllers/General";
import {NotificationsSnackbar} from "../../controllers/Notifications";
import notifySnackbar from "../../controllers/notifySnackbar";
import {refreshAll} from "../../controllers/Store";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import BottomMenu from "./BottomMenu";
import StickyHeader from "./StickyHeader";
import styles from "./styles/TopBottomMenuLayout.module.css";
import TopMenu from "./TopMenu";

export default (props) => {
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
