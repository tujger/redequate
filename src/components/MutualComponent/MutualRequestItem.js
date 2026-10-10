import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import {useBackend} from "../../../packages/backend";
import {toDateString} from "../../controllers/DateFormat";
import {usePages} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import Button from "../../controls/Button/Button";
import UserName from "../../controls/UserName/UserName";
import useRippleEffect from "../../helpers/useRippleEffect";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import ProgressView from "../ProgressView";
import {mutualRequestAccept, mutualRequestReject} from "./mutualComponentControls";
import styles from "./styles/MutualItem.module.css";

export default (
    {
        data,
        label,
        onDelete = () => {
        },
        pattern,
        skeleton
    }) => {
    const pages = usePages();
    const dispatch = useDispatch();
    const history = useHistory();
    const backend = useBackend();
    const [state, setState] = React.useState({});
    const {disabled} = state;
    const {key, userData, value} = data;
    const {t} = useTranslation();
    const onPointerDown = useRippleEffect();
    const patternClass = pattern
        ? styles[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`]
        : styles.cardFlat;

    const handleOpen = () => {
        if (!disabled) history.push(pages.user.route + userData.id);
    };

    const handleKeyDown = event => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        handleOpen();
    };

    const handleAccept = event => {
        event.stopPropagation();
        dispatch(ProgressView.SHOW);
        setState(current => ({...current, disabled: true}));
        mutualRequestAccept({backend, requestId: key})
            .then(result => {
                console.log(result);
                onDelete(result);
            })
            .catch(error => {
                notifySnackbar(error);
                setState(current => ({...current, disabled: false}));
            })
            .finally(() => dispatch(ProgressView.HIDE));
    };

    const handleReject = event => {
        event.stopPropagation();
        mutualRequestReject({requestId: key})
            .then(result => {
                console.log(result);
                onDelete(result);
            })
            .catch(error => {
                notifySnackbar(error);
                setState(current => ({...current, disabled: false}));
            })
            .finally(() => dispatch(ProgressView.HIDE));
    };

    const buttonProps = {
        disabled,
        onPointerDown: event => event.stopPropagation(),
        size: "small",
    };

    if (label) return <ItemPlaceholderComponent label={label} classes={styles} pattern={"flat"}/>;
    if (skeleton) return <ItemPlaceholderComponent classes={styles} pattern={"flat"}/>;

    return <div
        aria-disabled={disabled || undefined}
        className={[styles.card, styles.item, patternClass].filter(Boolean).join(" ")}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        onPointerDown={disabled ? undefined : onPointerDown}
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
            <div className={styles.title}>
                <UserName id={userData.id}>{userData.name}</UserName>
                <div className={styles.date} title={new Date(value.timestamp).toLocaleString()}>
                    {toDateString(value.timestamp)}
                </div>
            </div>
            <div className={styles.message}>{value.message}</div>
            <div className={styles.actions}>
                <Button {...buttonProps} onClick={handleAccept} title={t("Mutual.Accept")}>{t("Mutual.Accept")}</Button>
                <Button {...buttonProps} color={"secondary"} onClick={handleReject} title={t("Mutual.Reject")}
                        variant={"outlined"}>{t("Mutual.Reject")}</Button>
            </div>
        </div>
    </div>;
};
