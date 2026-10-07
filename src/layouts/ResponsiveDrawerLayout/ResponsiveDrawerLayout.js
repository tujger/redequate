import ChevronLeft from "@mui/icons-material/ChevronLeft";
import React from "react";
import ReactDOM from "react-dom";
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
import {hasWrapperControlInterface, wrapperControlCall} from "../../controllers/WrapperControl";
import Button from "../../controls/Button/Button";
import MainAppbar from "./MainAppbar";
import MainMenu from "./MainMenu";
import styles from "./styles/ResponsiveDrawerLayout.module.css";

const drawerWidth = 240;
const swipeThreshold = 60;
const edgeWidth = 24;
const transitionMs = 220;

const useNarrow = () => {
    const [narrow, setNarrow] = React.useState(() => typeof window !== "undefined" && window.innerWidth < 960);

    React.useEffect(() => {
        const update = () => setNarrow(window.innerWidth < 960);
        window.addEventListener("resize", update);
        update();
        return () => window.removeEventListener("resize", update);
    }, []);

    return narrow;
};

export default (props) => {
    const {container, footerComponent, menu, title, headerComponent = <HeaderComponent/>, copyright} = props;
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [swipeProgress, setSwipeProgress] = React.useState(null);
    const [showDuringExit, setShowDuringExit] = React.useState(false);
    const narrow = useNarrow();
    const panelRef = React.useRef(null);
    const pointerRef = React.useRef(null);
    const copyrightClicks = React.useRef(0);
    const {t} = useTranslation();
    const currentUserData = useCurrentUserData();
    const store = useStore();

    const closeDrawer = React.useCallback(() => setMobileOpen(false), []);
    const openDrawer = React.useCallback(() => setMobileOpen(true), []);
    const toggleDrawer = React.useCallback(() => setMobileOpen(value => !value), []);

    React.useEffect(() => {
        if (!narrow) {
            setMobileOpen(false);
            setSwipeProgress(null);
            setShowDuringExit(false);
        }
    }, [narrow]);

    React.useEffect(() => {
        if (mobileOpen) {
            setShowDuringExit(true);
            return undefined;
        }
        const timer = setTimeout(() => setShowDuringExit(false), transitionMs);
        return () => clearTimeout(timer);
    }, [mobileOpen]);

    React.useEffect(() => {
        if (!narrow || !mobileOpen) return undefined;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.focus();

        const handleKeyDown = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                closeDrawer();
                return;
            }
            if (event.key !== "Tab" || !panelRef.current) return;
            const entries = Array.from(panelRef.current.querySelectorAll(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (!entries.length) {
                event.preventDefault();
                panelRef.current.focus();
                return;
            }
            const first = entries[0];
            const last = entries[entries.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [narrow, mobileOpen, closeDrawer]);

    React.useEffect(() => {
        if (!narrow || !mobileOpen) return undefined;
        const previous = window.onpopstate;
        const handlePopState = () => {
            window.onpopstate = previous;
            closeDrawer();
            window.history.go(1);
        };
        window.onpopstate = handlePopState;
        return () => {
            if (window.onpopstate === handlePopState) window.onpopstate = previous;
        };
    }, [narrow, mobileOpen, closeDrawer]);

    React.useEffect(() => {
        if (hasWrapperControlInterface()) {
            wrapperControlCall({method: "swipeable", value: !mobileOpen}).catch(notifySnackbar);
        }
    }, [mobileOpen]);

    React.useEffect(() => {
        if (!narrow) return undefined;

        const handlePointerDown = event => {
            if (event.pointerType !== "touch") return;
            const opening = !mobileOpen && event.clientX <= edgeWidth;
            const closing = mobileOpen && panelRef.current?.contains(event.target);
            if (!opening && !closing) return;
            pointerRef.current = {
                id: event.pointerId,
                mode: opening ? "open" : "close",
                startX: event.clientX,
                startY: event.clientY,
                horizontal: false,
            };
            setSwipeProgress(opening ? 0 : 1);
        };
        const handlePointerMove = event => {
            const gesture = pointerRef.current;
            if (!gesture || gesture.id !== event.pointerId) return;
            const dx = event.clientX - gesture.startX;
            const dy = event.clientY - gesture.startY;
            if (!gesture.horizontal && Math.abs(dy) > Math.abs(dx) + 8) {
                pointerRef.current = null;
                setSwipeProgress(null);
                return;
            }
            if (Math.abs(dx) > Math.abs(dy) + 8) gesture.horizontal = true;
            if (!gesture.horizontal) return;
            event.preventDefault();
            const progress = gesture.mode === "open"
                ? Math.max(0, Math.min(1, dx / drawerWidth))
                : Math.max(0, Math.min(1, 1 + dx / drawerWidth));
            setSwipeProgress(progress);
        };
        const handlePointerEnd = event => {
            const gesture = pointerRef.current;
            if (!gesture || gesture.id !== event.pointerId) return;
            pointerRef.current = null;
            if (event.type === "pointercancel") {
                setSwipeProgress(null);
                return;
            }
            const dx = event.clientX - gesture.startX;
            if (gesture.horizontal && gesture.mode === "open" && dx >= swipeThreshold) openDrawer();
            if (gesture.horizontal && gesture.mode === "close" && dx <= -swipeThreshold) closeDrawer();
            setSwipeProgress(null);
        };

        document.addEventListener("pointerdown", handlePointerDown, true);
        window.addEventListener("pointermove", handlePointerMove, {passive: false});
        window.addEventListener("pointerup", handlePointerEnd);
        window.addEventListener("pointercancel", handlePointerEnd);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerEnd);
            window.removeEventListener("pointercancel", handlePointerEnd);
            pointerRef.current = null;
        };
    }, [narrow, mobileOpen, closeDrawer, openDrawer]);

    const handleCopyrightClick = event => {
        if (!matchRole(Role.ADMIN, currentUserData)) return;
        copyrightClicks.current++;
        if (copyrightClicks.current === 3) {
            const count = enableDisabledPages();
            if (count) {
                event.preventDefault();
                refreshAll(store);
                notifySnackbar(t(`Admin.Temporarily enabled ${count} hidden page(s)`));
            }
        }
    };

    const drawerContent = <>
        <headerComponent.type {...headerComponent.props} narrow title={title}/>
        {narrow && <Button
            className={styles.closeButton}
            color={"default"}
            icon={<ChevronLeft/>}
            onClick={closeDrawer}
            title={"Close navigation"}
            variant={"text"}
        />}
        <div className={styles.divider} role="separator"/>
        <MainMenu items={menu} onClick={closeDrawer}/>
        <div className={styles.copyrightRow} onClick={handleCopyrightClick}>
            <span className={styles.copyright}>{copyright}</span>
        </div>
    </>;

    const progress = swipeProgress === null ? (mobileOpen ? 1 : 0) : swipeProgress;
    const portalVisible = mobileOpen || swipeProgress !== null || showDuringExit;
    const temporaryDrawer = narrow && typeof document !== "undefined" && ReactDOM.createPortal(
        <div
            aria-hidden={!mobileOpen}
            className={[styles.portal, portalVisible && styles.portalVisible,
                swipeProgress !== null && styles.dragging].filter(Boolean).join(" ")}
            data-open={mobileOpen}
            data-progress={progress}
            style={{
                "--drawer-translate": `${(progress - 1) * 100}%`,
                "--drawer-opacity": progress * 0.32
            }}
        >
            <div aria-hidden="true" className={styles.backdrop} onClick={closeDrawer}/>
            <nav
                aria-label="Navigation menu"
                aria-modal={mobileOpen || undefined}
                className={[styles.drawer, styles.temporaryDrawer].join(" ")}
                ref={panelRef}
                role="dialog"
                tabIndex={-1}
            >
                {drawerContent}
            </nav>
        </div>, container || document.body);

    return <div className={["ResponsiveDrawerLayout", styles.container].join(" ")}>
        {narrow ? temporaryDrawer : <nav aria-label="Navigation menu" className={styles.drawer}>
            {drawerContent}
        </nav>}
        <MainAppbar
            {...props}
            className={styles.appbar}
            onHamburgerClick={narrow ? toggleDrawer : undefined}
        />
        <div className={styles.indent}/>
        <MainContent/>
        {footerComponent}
        <Snackbar/>
        <NotificationsSnackbar/>
        <DispatchedConfirmComponent open={false}/>
    </div>;
}
