import React from "react";
import ReactDOM from "react-dom";
import styles from "./styles/ModalComponent.module.css";
import {useHistory} from "react-router-dom";

let pageScrollLockCount = 0;
let previousPageOverflow;

const lockPageScroll = () => {
    if (pageScrollLockCount === 0) {
        previousPageOverflow = {
            body: document.body.style.overflow,
            documentElement: document.documentElement.style.overflow,
        };
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
    }
    pageScrollLockCount += 1;
};

const unlockPageScroll = () => {
    pageScrollLockCount = Math.max(0, pageScrollLockCount - 1);
    if (pageScrollLockCount !== 0 || !previousPageOverflow) return;
    document.body.style.overflow = previousPageOverflow.body;
    document.documentElement.style.overflow = previousPageOverflow.documentElement;
    previousPageOverflow = undefined;
};

export default ({
    children,
    closeOnBackdropClick = true,
    enableBackScroll = false,
    onClose,
}) => {
    const history = useHistory();
    const onCloseRef = React.useRef(onClose);
    onCloseRef.current = onClose;

    React.useEffect(() => {
        if (enableBackScroll) return undefined;
        lockPageScroll();
        return unlockPageScroll;
    }, [enableBackScroll]);

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
