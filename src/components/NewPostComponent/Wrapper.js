import React from "react";
import ModalComponent from "../ModalComponent";

export default ({inline, children, onClose}) => {
    return inline
        ? <>
            {children}
        </>
        : <ModalComponent open={true} onClose={onClose}>
            {children}
        </ModalComponent>
}
