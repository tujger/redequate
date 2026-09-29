import React from "react";
import ReactDOM from "react-dom";
import {useHistory} from "react-router-dom";
import styles from "./styles/ModalComponent.module.css";

export default (
    {
        children,
        closeOnBackdropClick = true,
        onClose,
    }) => {
    const history = useHistory();
    const onCloseRef = React.useRef(onClose);
    onCloseRef.current = onClose;

    React.useEffect(() => {
        const unblock = history.block(() => {
            onCloseRef.current?.();
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
            onClick={closeOnBackdropClick ? event => {
                event.stopPropagation();
                onCloseRef.current?.(event);
            } : undefined}
            onWheel={stopPropagation}
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
            onScroll={stopPropagation}
            onSubmit={stopPropagation}
            onTouchEnd={stopPropagation}
            onTouchStart={stopPropagation}
            role={"dialog"}
        >
            {children}
        </div>
    </div>;

    return typeof document === "undefined" ? modal : ReactDOM.createPortal(modal, document.body);
}
