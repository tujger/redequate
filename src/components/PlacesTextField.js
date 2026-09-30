import React from "react";
import ReactDOM from "react-dom";
import {useTranslation} from "react-i18next";
import {GeoCode} from "geo-coder-t";
import PropTypes from "prop-types";
import TextField from "../controls/TextField/TextField";
import styles from "./styles/PlacesTextField.module.css";

const featureTypes = {
    citystate: ["city", "state"],
    latlng: ["lat", "lng"],
    formatted: [],
};
const directTypes = ["formatted", "short_usps", "short_ru", "lat", "lng", "latlng", "citystate"];
let nextListId = 0;

const formatOptions = (results, type) => {
    const seen = new Set();
    return results.map(result => {
        const address = {...result.address};
        const rawAddress = result.raw?.address || {};
        address.city = address.city || rawAddress.locality;
        const tokens = [
            rawAddress.house_number,
            rawAddress.road,
            rawAddress.locality,
            rawAddress.state,
            rawAddress.country,
            rawAddress.postcode,
        ].filter(Boolean);
        const data = {
            ...result,
            address,
            latlng: `${result.lat},${result.lng}`,
            citystate: [address.city, address.state].filter(Boolean).join(", "),
            short_usps: tokens.join(", "),
            short_ru: [...tokens].reverse().join(", "),
        };
        const rawTitle = directTypes.includes(type) ? data[type] : address[type];
        return {title: rawTitle == null ? "" : String(rawTitle), data};
    }).filter(option => {
        if (!option.title || seen.has(option.title)) return false;
        seen.add(option.title);
        return true;
    });
};

export default props => {
    const {
        className,
        disabled = false,
        fullWidth = false,
        name,
        onBlur,
        onChange,
        onFocus,
        onKeyDown: givenOnKeyDown,
        type = "formatted",
        value = "",
        ...fieldProps
    } = props;
    const {t} = useTranslation();
    const anchorRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const taskRef = React.useRef(null);
    const requestRef = React.useRef(0);
    const listId = React.useRef(null);
    if (!listId.current) listId.current = `redequate-places-${++nextListId}`;
    const [options, setOptions] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const [position, setPosition] = React.useState({left: 0, top: 0, width: 0});

    const cancelSearch = React.useCallback(() => {
        clearTimeout(taskRef.current);
        taskRef.current = null;
        requestRef.current += 1;
    }, []);

    React.useEffect(() => {
        cancelSearch();
        setOptions([]);
        setLoading(false);
        setOpen(false);
        setActiveIndex(-1);
    }, [disabled, type, cancelSearch]);

    React.useEffect(() => () => cancelSearch(), [cancelSearch]);

    React.useEffect(() => {
        if (value) return;
        cancelSearch();
        setOptions([]);
        setLoading(false);
        setOpen(false);
        setActiveIndex(-1);
    }, [value, cancelSearch]);

    React.useEffect(() => {
        if (!open) return undefined;
        const handleOutside = event => {
            if (anchorRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
            cancelSearch();
            setLoading(false);
            setOpen(false);
            setActiveIndex(-1);
        };
        document.addEventListener("pointerdown", handleOutside);
        return () => document.removeEventListener("pointerdown", handleOutside);
    }, [open, cancelSearch]);

    React.useLayoutEffect(() => {
        if (!open) return undefined;
        const updatePosition = () => {
            const rect = anchorRef.current?.getBoundingClientRect();
            if (!rect) return;
            const width = Math.min(rect.width, window.innerWidth - 16);
            const height = Math.min(menuRef.current?.offsetHeight || 240, 240);
            const above = rect.top - height - 4;
            const below = rect.bottom + 4;
            const top = below + height > window.innerHeight - 8 && above >= 8 ? above : below;
            const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            setPosition(current => current.left === left && current.top === top && current.width === width
                ? current : {left, top, width});
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        document.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            document.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, options.length, loading]);

    const closeMenu = () => {
        cancelSearch();
        setLoading(false);
        setOpen(false);
        setActiveIndex(-1);
    };

    const handleInputChange = event => {
        const text = event.target.value;
        cancelSearch();
        setOptions([]);
        setActiveIndex(-1);
        onChange?.(event, text);
        if (disabled || !text.trim()) {
            setLoading(false);
            setOpen(false);
            return;
        }

        const request = requestRef.current;
        setLoading(true);
        setOpen(true);
        taskRef.current = setTimeout(() => {
            taskRef.current = null;
            const geoCode = new GeoCode("osm", {featuretype: featureTypes[type] || type});
            geoCode.geolookup(text).then(results => {
                if (request !== requestRef.current) return;
                const items = formatOptions(results, type);
                setOptions(items);
                setLoading(false);
                setOpen(items.length > 0);
            }).catch(() => {
                if (request !== requestRef.current) return;
                setOptions([]);
                setLoading(false);
                setOpen(false);
            });
        }, 500);
    };

    const handleSelect = option => {
        closeMenu();
        setOptions([]);
        onChange?.({
            target: {name, value: option.title},
            persist: () => {},
        }, option);
    };

    const handleKeyDown = event => {
        givenOnKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;
        if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            closeMenu();
        } else if (event.key === "Tab" && open) {
            closeMenu();
        } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => event.key === "ArrowDown"
                ? (index + 1) % options.length
                : (index - 1 + options.length) % options.length);
        } else if (event.key === "Enter" && open && activeIndex >= 0) {
            event.preventDefault();
            handleSelect(options[activeIndex]);
        }
    };

    const menu = open && typeof document !== "undefined" && ReactDOM.createPortal(<div
        className={styles.menu}
        id={listId.current}
        ref={menuRef}
        role={"listbox"}
        style={position}
    >
        {loading && <div className={styles.status} role={"status"}>{t("Common.Loading...")}</div>}
        {!loading && options.map((option, index) => <div
            aria-selected={index === activeIndex}
            className={[styles.option, index === activeIndex && styles.active].filter(Boolean).join(" ")}
            id={`${listId.current}-option-${index}`}
            key={option.title}
            onClick={() => handleSelect(option)}
            onMouseEnter={() => setActiveIndex(index)}
            onPointerDown={event => event.preventDefault()}
            role={"option"}
        >{option.title}</div>)}
    </div>, document.body);

    return <div className={[styles.root, fullWidth && styles.fullWidth].filter(Boolean).join(" ")} ref={anchorRef}>
        <TextField
            {...fieldProps}
            aria-activedescendant={open && activeIndex >= 0 ? `${listId.current}-option-${activeIndex}` : undefined}
            aria-autocomplete={"list"}
            aria-controls={open ? listId.current : undefined}
            aria-expanded={open}
            className={className}
            disabled={disabled}
            fullWidth={fullWidth}
            name={name}
            onBlur={event => {
                closeMenu();
                onBlur?.(event);
            }}
            onChange={handleInputChange}
            onFocus={event => {
                if (options.length || loading) setOpen(true);
                onFocus?.(event);
            }}
            onKeyDown={handleKeyDown}
            role={"combobox"}
            value={value ?? ""}
        />
        {menu}
    </div>;
};
