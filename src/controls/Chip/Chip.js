import CancelIcon from "@mui/icons-material/Cancel";
import React from "react";
import Button from "../Button/Button";
import styles from "./Chip.module.css";

export default ({avatar, color = "default", label, onDelete}) => {
    const avatarContent = avatar == null
        ? null
        : React.isValidElement(avatar)
            ? React.cloneElement(avatar, {
                className: [avatar.props.className, styles.avatar].filter(Boolean).join(" "),
            })
            : avatar;

    const handleDelete = event => {
        event.stopPropagation();
        onDelete(event);
    };

    return <div className={[styles.chip, color === "secondary" && styles.secondary].filter(Boolean).join(" ")}>
        {avatarContent}
        {label != null && <span className={styles.label}>{label}</span>}
        {onDelete && <Button
            className={styles.deleteButton}
            color={"secondary"}
            icon={<CancelIcon/>}
            onClick={handleDelete}
            size={"small"}
            title={"Delete"}
        />}
    </div>;
}
