import React from "react";
import ReactDOM from "react-dom";
import styles from "./Menu.module.css";

const focusFirst = menu => menu?.querySelector('[role="menuitem"], [role="option"]')?.focus();

const MenuBranch = ({item, items, renderItem, closeTree}) => {
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
        {renderItem(item, {selector: true, open, onActivate: activate,
            onHover: () => window.innerWidth > 599 && setOpen(true), closeTree})}
        {open && <div className={styles.submenu} ref={submenuRef} role="menu">
            {renderEntries(items, renderItem, closeTree)}
        </div>}
    </div>;
};

const renderEntries = (items, renderItem, closeTree) => items.map((entry, index) => {
    if (Array.isArray(entry)) {
        if (!entry.length) return null;
        if (entry.length === 1) return <React.Fragment key={index}>
            {renderItem(entry[0], {selector: false, closeTree})}
        </React.Fragment>;
        return <MenuBranch
            closeTree={closeTree}
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

const Menu = ({anchorEl, autoFocus = true, backdrop = false, children, className, closeOnBlur = false,
    closeOnMouseLeave = false, containerRef, id, items, load, matchAnchorWidth = false, minWidth = false,
    offset, onClose, onDisplayedOptionsChange, onLoadError, onLoaded, open, options,
    placement = "below", positionKey, reloadKey, renderItem, role = "menu", staleMs = 0}) => {
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
    const displayedOptions = lazy ? lazyState.options : options || [];
    const getAnchor = () => anchorEl?.current || (anchorEl?.getBoundingClientRect ? anchorEl : null);

    const updatePosition = React.useCallback(() => {
        const anchor = anchorEl?.current || anchorEl;
        if (!anchor?.getBoundingClientRect || !menuRef.current) return;
        const rect = anchor.getBoundingClientRect();
        const menu = menuRef.current;
        const anchorWidth = Math.max(0, Math.min(rect.width, window.innerWidth - 16));
        const width = matchAnchorWidth ? anchorWidth : Math.max(menu.offsetWidth, minWidth ? rect.width : 0);
        const height = menu.offsetHeight;
        const desiredLeft = placement === "below-end" ? rect.right - width : rect.left;
        const left = Math.max(8, Math.min(desiredLeft, window.innerWidth - width - 8));
        const gap = offset === undefined ? (placement === "below" ? 8 : 0) : offset;
        const below = rect.bottom + gap;
        const above = rect.top - height - gap;
        const top = below + height <= window.innerHeight - 8 || above < 8
            ? Math.max(8, Math.min(below, window.innerHeight - height - 8))
            : above;
        const positionWidth = matchAnchorWidth ? width : rect.width;
        setPosition(current => current.left === left && current.top === top && current.width === positionWidth
            ? current : {left, top, width: positionWidth});
    }, [anchorEl, matchAnchorWidth, minWidth, offset, placement]);

    React.useEffect(() => {
        if (!open || !lazy) {
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
    }, [open, lazy, reloadKey, staleMs]);

    React.useEffect(() => {
        if (open && lazy) onDisplayedOptionsChangeRef.current?.(displayedOptions);
    }, [open, lazy, displayedOptions]);

    React.useLayoutEffect(() => {
        if (!open) return undefined;
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
    }, [open, autoFocus, positionKey, lazyState.options, lazyState.loading, updatePosition]);

    React.useEffect(() => {
        if (!open || backdrop) return undefined;
        const handleOutside = event => {
            if (!menuRef.current?.contains(event.target) && !getAnchor()?.contains(event.target)) onClose?.(event);
        };
        document.addEventListener("pointerdown", handleOutside, true);
        return () => document.removeEventListener("pointerdown", handleOutside, true);
    }, [open, backdrop, anchorEl, onClose]);

    if (!open || typeof document === "undefined") return null;

    const handleKeyDown = event => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose?.(event);
            getAnchor()?.focus();
            return;
        }
        if (event.key === "Tab") {
            onClose?.(event);
            return;
        }
        const currentMenu = event.target.closest('[role="menu"], [role="listbox"]');
        if (!currentMenu || !menuRef.current?.contains(currentMenu)) return;
        if (event.key === "ArrowRight" && event.target.parentElement?.classList.contains(styles.branch)) {
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

    return ReactDOM.createPortal(<>
        {backdrop && <div
            aria-hidden="true"
            className={styles.backdrop}
            data-testid="select-backdrop"
            onClick={event => {
                event.stopPropagation();
                onClose?.(event);
            }}
        />}
        <div
            className={[styles.menu, role === "menu" && styles.actionMenu, className].filter(Boolean).join(" ")}
            id={id}
            onBlur={event => {
                if (closeOnBlur && !menuRef.current?.contains(event.relatedTarget)
                    && !getAnchor()?.contains(event.relatedTarget)) onClose?.(event);
            }}
            onClick={event => event.stopPropagation()}
            onKeyDown={handleKeyDown}
            onMouseLeave={event => {
                if (closeOnMouseLeave && !menuRef.current?.contains(event.relatedTarget)
                    && !getAnchor()?.contains(event.relatedTarget)) onClose?.(event);
            }}
            onPointerDown={event => event.stopPropagation()}
            ref={node => {
                menuRef.current = node;
                if (containerRef) containerRef.current = node;
            }}
            role={role}
            style={{left: position.left, minWidth: minWidth ? position.width : undefined,
                top: position.top, width: matchAnchorWidth ? position.width : undefined}}
        >
            {items ? renderEntries(items, renderItem, onClose)
                : typeof children === "function"
                    ? children({options: displayedOptions, loading: lazy && lazyState.loading})
                    : children}
        </div>
    </>, document.body);
};

export default Menu;
