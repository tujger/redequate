import React from "react";
import ReactDOM from "react-dom";
import styles from "./styles/ModalComponent.module.css";
import {useHistory} from "react-router-dom";

export default ({onClose, children}) => {
    const history = useHistory();
    const onCloseRef = React.useRef(onClose);

    React.useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    React.useEffect(() => {
        const unblock = history.block(event => {
            onCloseRef.current?.(event);
            return false;
        });
        return () => {
            unblock();
        };
    }, [history]);

    React.useEffect(() => {
        const handleKeyDown = event => {
            if (event.key !== "Escape") return;
            onCloseRef.current?.(event);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const stopPropagation = event => {
        event.stopPropagation();
    };

    const handleDialogKeyDown = event => {
        stopPropagation(event);
        if (event.key === "Escape") onCloseRef.current?.(event);
    };

    const modal = <div
        className={styles.root}
    >
        <div
            aria-hidden={"true"}
            className={styles.backdrop}
            onClick={event => onCloseRef.current?.(event)}
        />
        <div
            aria-modal={"true"}
            className={styles.dialog}
            onBeforeInput={stopPropagation}
            onChange={stopPropagation}
            onClick={stopPropagation}
            onCompositionEnd={stopPropagation}
            onCompositionStart={stopPropagation}
            onCompositionUpdate={stopPropagation}
            onContextMenu={stopPropagation}
            onCopy={stopPropagation}
            onCut={stopPropagation}
            onDoubleClick={stopPropagation}
            onDragEnd={stopPropagation}
            onDragOver={stopPropagation}
            onDragStart={stopPropagation}
            onDrop={stopPropagation}
            onInput={stopPropagation}
            onKeyDown={handleDialogKeyDown}
            onKeyUp={stopPropagation}
            onMouseDown={stopPropagation}
            onMouseUp={stopPropagation}
            onPaste={stopPropagation}
            onPointerDown={stopPropagation}
            onPointerUp={stopPropagation}
            onSubmit={stopPropagation}
            onTouchEnd={stopPropagation}
            onTouchStart={stopPropagation}
            onWheel={stopPropagation}
            role={"dialog"}
        >
            {children}
        </div>
    </div>;

    return typeof document === "undefined" ? modal : ReactDOM.createPortal(modal, document.body);
}
