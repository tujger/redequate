import BackIcon from "@mui/icons-material/ArrowBack";
import React from "react";
import ModalComponent from "../../components/ModalComponent";
import Button from "../../controls/Button/Button";
import SearchContent from "./SearchContent";
import styles from "./styles/SearchModal.module.css";

export default ({onClose, handleSearch}) => <ModalComponent
    ariaLabelledBy={"search-modal-title"}
    onClose={onClose}
>
    <div className={styles.mobileHeader}>
        <Button icon={<BackIcon/>} onClick={onClose} title={"Cancel"}/>
        <Button color={"secondary"} onClick={handleSearch}>Search</Button>
    </div>
    <div className={styles.title} id={"search-modal-title"}>Reply</div>
    <div className={styles.content}>
        <SearchContent/>
    </div>
    <div className={styles.actions}>
        <Button color={"secondary"} onClick={onClose} variant={"text"}>Cancel</Button>
        <Button color={"secondary"} onClick={handleSearch} variant={"text"}>Search</Button>
    </div>
</ModalComponent>;
