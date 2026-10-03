import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import {toDateString} from "../../controllers/DateFormat";
import {cacheDatas, useFirebase, usePages} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import Select from "../../controls/Select/Select";
import AvatarView from "../AvatarView";
import CounterComponent from "../CounterComponent";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import ListSwipeableItemComponent from "../ListSwipeableItemComponent";
import ProgressView from "../ProgressView";
import styles from "./styles/ListItemComponent.css";

export default (
    {
        primary = undefined,
        secondary = undefined,
        body = undefined,
        label,
        onClick = undefined,
        pattern,
        skeleton,
        ...props
    }) => {
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const [disabled, setDisabled] = React.useState(false);
    const [menuOpen, setMenuOpen] = React.useState(false);
    const {key, userData = {}, value} = data;
    const patternClass = pattern
        ? styles[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`]
        : styles.cardFlat;
    const isSameUser = value && value.uid === currentUserData.id;
    const isAdminUser = matchRole([Role.ADMIN], currentUserData);
    const menuLabel = unsubscribeLabel === undefined ? t("Mutual.Unsubscribe") : unsubscribeLabel;
    const hasMenu = menuLabel && (isSameUser || isAdminUser);

    const handleOpen = () => {
        if (disabled) return;
        if (!type || type === "users_public") {
            history.push(pages.user.route + userData.id);
        } else {
            history.push(pages[type].route + value.id);
        }
    };

    const handleKeyDown = event => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        handleOpen();
    };

    const handleUnsubscribe = event => {
        event.stopPropagation?.();
        setMenuOpen(false);
        console.log("handleUnsubscribe", key, typeId, currentUserData.id, value);
        dispatch(ProgressView.SHOW);
        setDisabled(true);
        cacheDatas.remove(key);
        cacheDatas.remove(value.id);
        firebase.database().ref("mutual").child(typeId).child(key).set(null)
            .then(() => onDelete({key, value}))
            .catch(error => {
                if (error && error.code === "PERMISSION_DENIED") {
                    notifySnackbar(new Error(t("Mutual.Can't unsubscribe")));
                } else {
                    notifySnackbar(error);
                }
                setDisabled(false);
            })
            .finally(() => dispatch(ProgressView.HIDE));
        return true;
    };

    const handleMenuOpen = event => {
        event?.stopPropagation();
        setMenuOpen(true);
    };

    const handleMenuClose = event => {
        event?.stopPropagation();
        setMenuOpen(false);
    };

    if (label) return <ItemPlaceholderComponent label={label} classes={styles} pattern={"flat"}/>;
    if (skeleton) return <ItemPlaceholderComponent classes={styles} pattern={"flat"}/>;

    return <ListSwipeableItemComponent
        className={[styles.card, styles.item, patternClass, value.hidden && styles.hidden].filter(Boolean).join(" ")}
        disabled={disabled}
        leftAction={{
            action: handleUnsubscribe,
            itemButton: (props) => <div {...props}>Unsubscribe</div>
        }}
        menu={hasMenu ? [{
            label: menuLabel + (isSameUser ? "" : " - force as Admin"),
            value: "unsubscribe",
        }] : undefined}
        onClickCapture={handleOpen}
        onKeyDown={handleKeyDown}
    >
        {avatar}
        <div className={styles.cardContent}>
            <div className={[styles.title].filter(Boolean).join(" ")}>
                <b className={styles.itemName}>{userData.name}</b>
                {counter && <span className={styles.counter}>
                    <CounterComponent
                        live
                        path={`${key}/mutual/${typeId}_s`}
                        prefix={"- "}
                        suffix={" follower(s)"}
                    />
                </span>}
                {value.timestamp && <span
                    className={styles.date}
                    title={new Date(value.timestamp).toLocaleString()}
                >{toDateString(value.timestamp)}</span>}
            </div>
            <div className={styles.message}>{value.message}</div>
        </div>
    </ListSwipeableItemComponent>
    // classes, children, leftAction, rightAction, onClickCapture, onContextMenu

    return <div
        className={[styles.card, styles.item, patternClass, value.hidden && styles.hidden].filter(Boolean).join(" ")}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        role={"button"}
        tabIndex={disabled ? -1 : 0}
    >
        <AvatarView
            className={styles.avatar}
            image={userData.image}
            initials={userData.initials}
            verified={true}
        />
        <div className={styles.cardContent}>
            <div className={[styles.title, hasMenu && styles.hasMenu].filter(Boolean).join(" ")}>
                <b className={styles.itemName}>{userData.name}</b>
                {counter && <span className={styles.counter}>
                    <CounterComponent
                        live
                        path={`${key}/mutual/${typeId}_s`}
                        prefix={"- "}
                        suffix={" follower(s)"}
                    />
                </span>}
                {value.timestamp && <span
                    className={styles.date}
                    title={new Date(value.timestamp).toLocaleString()}
                >{toDateString(value.timestamp)}</span>}
                {hasMenu && <Select
                    className={styles.menuButton}
                    disabled={disabled}
                    displayEmpty
                    iconMenu
                    inputProps={{"aria-label": menuLabel}}
                    onChange={handleUnsubscribe}
                    onClick={event => event.stopPropagation()}
                    onMouseDown={event => event.stopPropagation()}
                    onPointerDown={event => event.stopPropagation()}
                    onOpen={handleMenuOpen}
                    onClose={handleMenuClose}
                    open={menuOpen}
                    options={[{
                        label: menuLabel + (isSameUser ? "" : " - force as Admin"),
                        value: "unsubscribe",
                    }]}
                    value={""}
                />}
            </div>
            <div className={styles.message}>{value.message}</div>
        </div>
    </div>;
};
