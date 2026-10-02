import React from "react";
import ReactDOM from "react-dom";
import {useHistory} from "react-router-dom";
import styles from "./styles/ModalComponent.module.css";

export default (
    {
        anchorEl,
        ariaLabelledBy,
        children,
        closeOnBackdropClick = true,
        onClose,
    }) => {
    const history = useHistory();
    const onCloseRef = React.useRef(onClose);
    const dialogRef = React.useRef(null);
    const [position, setPosition] = React.useState(null);
    onCloseRef.current = onClose;

    React.useLayoutEffect(() => {
        if (!anchorEl) return undefined;
        const updatePosition = () => {
            const anchor = anchorEl.current || anchorEl;
            const dialog = dialogRef.current;
            if (!anchor?.getBoundingClientRect || !dialog) return;
            const rect = anchor.getBoundingClientRect();
            const margin = 8;
            const width = Math.min(dialog.offsetWidth, window.innerWidth - margin * 2);
            const height = dialog.scrollHeight || dialog.offsetHeight;
            const below = window.innerHeight - rect.bottom - margin;
            const above = rect.top - margin;
            const placeBelow = height <= below || below >= above;
            const maxHeight = Math.max(0, (placeBelow ? below : above) - margin);
            const visibleHeight = Math.min(height, maxHeight);
            const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2,
                window.innerWidth - width - margin));
            const top = placeBelow ? rect.bottom : rect.top - visibleHeight;
            setPosition(current => current?.left === left && current?.top === top && current?.maxHeight === maxHeight
                ? current : {left, top, maxHeight});
        };
        updatePosition();
        dialogRef.current?.focus();
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
        observer?.observe(dialogRef.current);
        window.addEventListener("resize", updatePosition);
        document.addEventListener("scroll", updatePosition, true);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", updatePosition);
            document.removeEventListener("scroll", updatePosition, true);
        };
    }, [anchorEl]);

    React.useEffect(() => {
        if (!history?.block) return undefined;
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
        className={[styles.root, anchorEl && styles.anchored].filter(Boolean).join(" ")}
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
            aria-labelledby={ariaLabelledBy}
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
            ref={dialogRef}
            role={"dialog"}
            style={anchorEl ? position || {visibility: "hidden"} : undefined}
            tabIndex={anchorEl ? -1 : undefined}
        >
            {children}
        </div>
    </div>;

    return typeof document === "undefined" ? modal : ReactDOM.createPortal(modal, document.body);
}
