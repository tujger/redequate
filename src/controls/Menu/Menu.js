import React from "react";
import ReactDOM from "react-dom";
import styles from "./Menu.module.css";

const focusFirst = menu => menu?.querySelector('[role="menuitem"], [role="option"]')?.focus();
const defaultAnchorOrigin = {vertical: "bottom", horizontal: "left"};
const defaultTransformOrigin = {vertical: "top", horizontal: "left"};

const originOffset = (origin, length) => {
    if (typeof origin === "number") return origin;
    if (origin === "center") return length / 2;
    if (origin === "bottom" || origin === "right") return length;
    return 0;
};

const oppositeOrigin = origin => origin === "top" ? "bottom" : "top";

const MenuBranch = ({color, item, items, renderItem, closeTree}) => {
    const [open, setOpen] = React.useState(false);
    const [openLeft, setOpenLeft] = React.useState(false);
    const branchRef = React.useRef(null);
    const submenuRef = React.useRef(null);

    React.useLayoutEffect(() => {
        if (!open || !branchRef.current || !submenuRef.current) return;
        const right = branchRef.current.getBoundingClientRect().right;
        setOpenLeft(right + submenuRef.current.offsetWidth > window.innerWidth - 8);
    }, [open]);

    const activate = event => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(current => window.innerWidth <= 599 ? !current : true);
    };

    return <div
        className={[styles.branch, openLeft && styles.openLeft].filter(Boolean).join(" ")}
        data-open={open}
        onKeyDown={event => {
            if (event.key !== "ArrowLeft" || !open) return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            branchRef.current?.querySelector('[role="menuitem"]')?.focus();
        }}
        onMouseEnter={() => window.innerWidth > 599 && setOpen(true)}
        onMouseLeave={event => {
            if (!branchRef.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        ref={branchRef}
    >
        {renderItem(item, {
            selector: true, open, onActivate: activate,
            onHover: () => window.innerWidth > 599 && setOpen(true), closeTree
        })}
        {open && <div className={styles.submenu} ref={submenuRef} role="menu">
            {renderEntries({color, items, renderItem, closeTree})}
        </div>}
    </div>;
};

const renderEntries = ({color, items, renderItem, closeTree, inline = false}) => items.map((entry, index) => {
    if (Array.isArray(entry)) {
        if (!entry.length) return null;
        if (entry.length === 1) {
            return <React.Fragment key={index}>
                {renderItem(entry[0], {selector: false, closeTree})}
            </React.Fragment>;
        }
        if (inline) {
            return <React.Fragment key={index}>
                {renderEntries({items: entry.slice(1), renderItem, closeTree, inline: true})}
            </React.Fragment>;
        }
        return <MenuBranch
            closeTree={closeTree}
            color={color}
            item={entry[0]}
            items={entry.slice(1)}
            key={index}
            renderItem={renderItem}
        />;
    }
    return <React.Fragment key={index}>
        {renderItem(entry, {selector: false, closeTree})}
    </React.Fragment>;
});

const Menu = (
    {
        anchorEl,
        anchorOrigin = defaultAnchorOrigin,
        autoFocus = true,
        backdrop = false,
        children,
        className,
        closeOnBlur = false,
        closeOnMouseLeave = false,
        color = undefined,
        containerRef,
        id,
        inline = false,
        items,
        load,
        matchAnchorWidth = false,
        minWidth = false,
        offset = 8,
        onClose,
        onDisplayedOptionsChange,
        onLoadError,
        onLoaded,
        open,
        options,
        positionKey,
        reloadKey,
        renderItem,
        role = "menu",
        staleMs = 0,
        transformOrigin = defaultTransformOrigin
    }) => {
    const menuRef = React.useRef(null);
    const loadRef = React.useRef(load);
    const onLoadedRef = React.useRef(onLoaded);
    const onLoadErrorRef = React.useRef(onLoadError);
    const onDisplayedOptionsChangeRef = React.useRef(onDisplayedOptionsChange);
    const [position, setPosition] = React.useState({left: 0, top: 0, width: 0});
    const [lazyState, setLazyState] = React.useState({options: [], loading: false});
    loadRef.current = load;
    onLoadedRef.current = onLoaded;
    onLoadErrorRef.current = onLoadError;
    onDisplayedOptionsChangeRef.current = onDisplayedOptionsChange;
    const lazy = options === undefined && Boolean(load);
    const visible = inline || open;
    const displayedOptions = lazy ? lazyState.options : options || [];
    const getAnchor = () => anchorEl?.current || (anchorEl?.getBoundingClientRect ? anchorEl : null);

    const updatePosition = React.useCallback(() => {
        const anchor = anchorEl?.current || anchorEl;
        if (!anchor?.getBoundingClientRect || !menuRef.current) return;
        const rect = anchor.getBoundingClientRect();
        const menu = menuRef.current;
        const anchorWidth = Math.max(0, Math.min(rect.width, window.innerWidth - 16));
        const width = matchAnchorWidth ? anchorWidth : Math.max(menu.offsetWidth, minWidth ? rect.width : 0);
        const menuHeight = menu.scrollHeight || menu.offsetHeight;
        const anchorHorizontal = anchorOrigin.horizontal ?? defaultAnchorOrigin.horizontal;
        const anchorVertical = anchorOrigin.vertical ?? defaultAnchorOrigin.vertical;
        const transformHorizontal = transformOrigin.horizontal ?? defaultTransformOrigin.horizontal;
        const transformVertical = transformOrigin.vertical ?? defaultTransformOrigin.vertical;
        const anchorX = rect.left + originOffset(anchorHorizontal, rect.width);
        const desiredLeft = anchorX - originOffset(transformHorizontal, width);
        const left = Math.max(8, Math.min(desiredLeft, window.innerWidth - width - 8));
        const edgePair = anchorVertical === "bottom" && transformVertical === "top"
            || anchorVertical === "top" && transformVertical === "bottom";
        let resolvedAnchorVertical = anchorVertical;
        let resolvedTransformVertical = transformVertical;
        if (edgePair) {
            const available = anchorVertical === "bottom"
                ? window.innerHeight - rect.bottom - offset - 8 : rect.top - offset - 8;
            const oppositeAvailable = anchorVertical === "bottom"
                ? rect.top - offset - 8 : window.innerHeight - rect.bottom - offset - 8;
            if (menuHeight > available && oppositeAvailable > available) {
                resolvedAnchorVertical = oppositeOrigin(anchorVertical);
                resolvedTransformVertical = oppositeOrigin(transformVertical);
            }
        }
        const maxHeight = Math.max(0, edgePair
            ? resolvedAnchorVertical === "bottom"
                ? window.innerHeight - rect.bottom - offset - 8 : rect.top - offset - 8
            : window.innerHeight - 16);
        const height = Math.min(menuHeight, maxHeight);
        const anchorY = rect.top + originOffset(resolvedAnchorVertical, rect.height ?? rect.bottom - rect.top);
        const transformY = originOffset(resolvedTransformVertical, height);
        const gap = edgePair ? (resolvedAnchorVertical === "bottom" ? offset : -offset) : 0;
        const desiredTop = anchorY - transformY + gap;
        const top = Math.max(8, Math.min(desiredTop, window.innerHeight - height - 8));
        const positionWidth = matchAnchorWidth ? width : rect.width;
        setPosition(current => current.left === left && current.top === top && current.width === positionWidth
        && current.maxHeight === maxHeight && current.overflowY === (menuHeight > maxHeight ? "auto" : undefined)
        && current.transformOrigin === `${originOffset(transformHorizontal, width)}px ${transformY}px`
            ? current : {
                left, top, width: positionWidth, maxHeight,
                overflowY: menuHeight > maxHeight ? "auto" : undefined,
                transformOrigin: `${originOffset(transformHorizontal, width)}px ${transformY}px`
            });
    }, [anchorEl, anchorOrigin.horizontal, anchorOrigin.vertical, matchAnchorWidth, minWidth, offset,
        transformOrigin.horizontal, transformOrigin.vertical]);

    React.useEffect(() => {
        if (!visible || !lazy) {
            setLazyState(current => current.options.length || current.loading
                ? {options: [], loading: false} : current);
            return undefined;
        }

        let active = true;
        const controller = new AbortController();
        setLazyState(current => ({options: staleMs > 0 ? current.options : [], loading: true}));
        const staleTimer = staleMs > 0 ? setTimeout(() => {
            if (active) setLazyState(current => current.loading ? {...current, options: []} : current);
        }, staleMs) : null;

        const run = async () => {
            try {
                const loaded = await loadRef.current({signal: controller.signal});
                if (!active) return;
                const nextOptions = Array.isArray(loaded) ? loaded : [];
                clearTimeout(staleTimer);
                setLazyState({options: nextOptions, loading: false});
                onLoadedRef.current?.(nextOptions);
            } catch (error) {
                if (!active || controller.signal.aborted) return;
                clearTimeout(staleTimer);
                setLazyState({options: [], loading: false});
                onLoadErrorRef.current?.(error);
            }
        };
        run();
        return () => {
            active = false;
            controller.abort();
            clearTimeout(staleTimer);
        };
    }, [visible, lazy, reloadKey, staleMs]);

    React.useEffect(() => {
        if (visible && lazy) onDisplayedOptionsChangeRef.current?.(displayedOptions);
    }, [visible, lazy, displayedOptions]);

    React.useLayoutEffect(() => {
        if (!open || inline) return undefined;
        updatePosition();
        if (autoFocus) {
            const selected = menuRef.current?.querySelector('[data-selected="true"]');
            (selected || menuRef.current?.querySelector('[role="menuitem"], [role="option"]'))?.focus();
        }
        window.addEventListener("resize", updatePosition);
        document.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            document.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, inline, autoFocus, positionKey, lazyState.options, lazyState.loading, updatePosition]);

    React.useEffect(() => {
        if (!open || inline || backdrop) return undefined;
        const handleOutside = event => {
            if (!menuRef.current?.contains(event.target) && !getAnchor()?.contains(event.target)) onClose?.(event);
        };
        document.addEventListener("pointerdown", handleOutside, true);
        return () => document.removeEventListener("pointerdown", handleOutside, true);
    }, [open, inline, backdrop, anchorEl, onClose]);

    if (!visible || typeof document === "undefined") return null;

    const handleKeyDown = event => {
        if (event.defaultPrevented) return;
        if (!inline && event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose?.(event);
            getAnchor()?.focus();
            return;
        }
        if (!inline && event.key === "Tab") {
            onClose?.(event);
            return;
        }
        const currentMenu = event.target.closest('[role="menu"], [role="listbox"]');
        if (!currentMenu || !menuRef.current?.contains(currentMenu)) return;
        if (!inline && event.key === "ArrowRight" && event.target.parentElement?.classList.contains(styles.branch)) {
            event.preventDefault();
            event.stopPropagation();
            if (event.target.parentElement.getAttribute("data-open") !== "true") event.target.click();
            requestAnimationFrame(() => focusFirst(event.target.parentElement.querySelector('[role="menu"]')));
            return;
        }
        const entries = Array.from(currentMenu.querySelectorAll('[role="menuitem"], [role="option"]'))
            .filter(entry => entry.closest('[role="menu"], [role="listbox"]') === currentMenu);
        const index = entries.indexOf(document.activeElement);
        let nextIndex;
        if (event.key === "ArrowDown") nextIndex = (index + 1) % entries.length;
        else if (event.key === "ArrowUp") nextIndex = (index - 1 + entries.length) % entries.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = entries.length - 1;
        else if ((event.key === "Enter" || event.key === " ") && index >= 0) {
            event.preventDefault();
            entries[index].click();
            return;
        } else return;
        if (!entries.length) return;
        event.preventDefault();
        event.stopPropagation();
        entries[nextIndex].focus();
    };

    const menu = <>
        {!inline && backdrop && <div
            aria-hidden={"true"}
            className={styles.backdrop}
            data-testid={"select-backdrop"}
            onClick={event => {
                event.stopPropagation();
                onClose?.(event);
            }}
        />}
        <div
            className={[
                color === "inherit" && styles.inherit,
                color === "primary" && styles.primary,
                color === "secondary" && styles.secondary,
                styles.menu,
                role === "menu" && styles.actionMenu,
                inline && styles.inline,
                className
            ].filter(Boolean).join(" ")}
            id={id}
            onBlur={event => {
                if (closeOnBlur && !menuRef.current?.contains(event.relatedTarget)
                    && !getAnchor()?.contains(event.relatedTarget)) onClose?.(event);
            }}
            onClick={inline ? undefined : event => event.stopPropagation()}
            onKeyDown={handleKeyDown}
            onMouseLeave={event => {
                if (closeOnMouseLeave && !menuRef.current?.contains(event.relatedTarget)
                    && !getAnchor()?.contains(event.relatedTarget)) onClose?.(event);
            }}
            onPointerDown={inline ? undefined : event => event.stopPropagation()}
            ref={node => {
                menuRef.current = node;
                if (containerRef) containerRef.current = node;
            }}
            role={role}
            style={inline ? undefined : {
                left: position.left, maxHeight: position.maxHeight,
                minWidth: minWidth ? position.width : undefined,
                overflowY: position.overflowY,
                top: position.top, transformOrigin: position.transformOrigin,
                width: matchAnchorWidth ? position.width : undefined
            }}
        >
            {items ? renderEntries({color, items, renderItem, closeTree: onClose, inline})
                : typeof children === "function"
                    ? children({options: displayedOptions, loading: lazy && lazyState.loading})
                    : children}
        </div>
    </>;

    return inline ? menu : ReactDOM.createPortal(menu, document.body);
};

export default Menu;
