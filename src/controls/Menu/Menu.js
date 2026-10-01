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

const Menu = ({anchorEl, autoFocus = true, backdrop = false, children, closeOnBlur = false,
    closeOnMouseLeave = false, containerRef, id, items, minWidth = false, onClose, open,
    placement = "below", renderItem, role = "menu"}) => {
    const menuRef = React.useRef(null);
    const [position, setPosition] = React.useState({left: 0, top: 0, width: 0});
    const getAnchor = () => anchorEl?.current || (anchorEl?.getBoundingClientRect ? anchorEl : null);

    const updatePosition = React.useCallback(() => {
        const anchor = anchorEl?.current || anchorEl;
        if (!anchor?.getBoundingClientRect || !menuRef.current) return;
        const rect = anchor.getBoundingClientRect();
        const menu = menuRef.current;
        const width = Math.max(menu.offsetWidth, minWidth ? rect.width : 0);
        const height = menu.offsetHeight;
        const desiredLeft = placement === "below-end" ? rect.right - width : rect.left;
        const left = Math.max(8, Math.min(desiredLeft, window.innerWidth - width - 8));
        const below = rect.bottom + (placement === "below" ? 8 : 0);
        const above = rect.top - height - (placement === "below" ? 8 : 0);
        const top = below + height <= window.innerHeight - 8 || above < 8
            ? Math.max(8, Math.min(below, window.innerHeight - height - 8))
            : above;
        setPosition(current => current.left === left && current.top === top && current.width === rect.width
            ? current : {left, top, width: rect.width});
    }, [anchorEl, minWidth, placement]);

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
    }, [open, autoFocus, updatePosition]);

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
            className={[styles.menu, role === "menu" && styles.actionMenu].filter(Boolean).join(" ")}
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
                top: position.top}}
        >
            {items ? renderEntries(items, renderItem, onClose) : children}
        </div>
    </>, document.body);
};

export default Menu;
