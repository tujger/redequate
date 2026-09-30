import CloseIcon from "@material-ui/icons/Close";
import CollapseIcon from "@material-ui/icons/ExpandLess";
import ExpandIcon from "@material-ui/icons/ExpandMore";
import React from "react";
import Button from "../controls/Button/Button";
import useRippleEffect from "../helpers/useRippleEffect";
import styles from "./styles/RichSnackbarContent.module.css";

export default React.forwardRef((props, ref) => {
    const {
        body,
        buttonLabel,
        closeAfterClick = true,
        closeHandler,
        image,
        message,
        onButtonClick,
        onClick,
        variant = "default",
    } = props;
    const [expanded, setExpanded] = React.useState(false);
    const onMessagePointerDown = useRippleEffect();
    const onCardPointerDown = useRippleEffect();
    const hasCard = Boolean(body || image);
    const cardShown = hasCard && expanded;

    const handleAction = event => {
        event.stopPropagation();
        onButtonClick?.(event);
        closeHandler();
    };
    const handleCardClick = event => {
        onClick?.(event);
        if (closeAfterClick) closeHandler();
    };
    const handleKeyboardClick = callback => event => {
        if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        callback(event);
    };

    return <div className={styles.root} ref={ref}>
        <div className={[styles.header, styles[variant]].filter(Boolean).join(" ")}>
            <div
                className={[styles.message, onClick && styles.clickable].filter(Boolean).join(" ")}
                onClick={onClick}
                onKeyDown={onClick ? handleKeyboardClick(onClick) : undefined}
                onPointerDown={onClick ? onMessagePointerDown : undefined}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
            >{message}</div>
            <div className={styles.headerActions}>
                {buttonLabel && !cardShown && <Button
                    color={"inherit"}
                    onClick={handleAction}
                    size={"small"}
                    variant={"text"}
                >{buttonLabel}</Button>}
                {hasCard && <Button
                    color={"inherit"}
                    icon={cardShown ? <CollapseIcon fontSize={"small"}/> : <ExpandIcon fontSize={"small"}/>}
                    onClick={() => setExpanded(value => !value)}
                    size={"small"}
                    title={cardShown ? "Collapse" : "Expand"}
                />}
                {(!buttonLabel || onButtonClick) && <Button
                    color={"inherit"}
                    icon={<CloseIcon fontSize={"small"}/>}
                    onClick={() => closeHandler()}
                    size={"small"}
                    title={"Close"}
                />}
            </div>
        </div>
        {cardShown && <div className={styles.card}>
            <div
                className={styles.cardAction}
                onClick={handleCardClick}
                onKeyDown={handleKeyboardClick(handleCardClick)}
                onPointerDown={onCardPointerDown}
                role={"button"}
                tabIndex={0}
            >
                {image && <div
                    aria-label={typeof message === "string" ? message : undefined}
                    className={[styles.image, !body && styles.imageOnly].filter(Boolean).join(" ")}
                    role={"img"}
                    style={{backgroundImage: `url(${image})`}}
                />}
                {body && <div className={styles.body}>{body}</div>}
            </div>
            {buttonLabel && <div className={styles.cardActions}>
                <Button
                    color={"primary"}
                    onClick={handleAction}
                    variant={"text"}
                >
                    {buttonLabel}
                </Button>
            </div>}
        </div>}
    </div>;
});
