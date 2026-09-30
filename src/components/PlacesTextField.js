import React from "react";
import ReactDOM from "react-dom";
import {useTranslation} from "react-i18next";
import {useMetaInfo} from "../controllers/General";
import TextField from "../controls/TextField/TextField";
import selectStyles from "../controls/Select/Select.module.css";
import styles from "./styles/PlacesTextField.module.css";

const geoapifyTypes = ["country", "state", "city", "postcode", "street", "amenity", "locality"];
const directTypes = ["formatted", "short_usps", "short_ru", "lat", "lng", "latlng", "citystate"];
let nextListId = 0;

const formatOptions = (results, type) => {
    const seen = new Set();
    return results.map(result => {
        const city = result.city || result.municipality || result.village || result.town;
        const state = result.state_code || result.state;
        const address = {
            ...result,
            city,
            state,
            locality: city,
            road: result.street,
            house_number: result.housenumber,
        };
        const tokens = [
            result.housenumber,
            result.street,
            city,
            state,
            result.country,
            result.postcode,
        ].filter(Boolean);
        const data = {
            ...result,
            address,
            lng: result.lon,
            latlng: `${result.lat},${result.lon}`,
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
    const geoapifyApiKey = useMetaInfo()?.settings?.geoapifyApiKey;
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
    }, [disabled, type, geoapifyApiKey, cancelSearch]);

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
        if (disabled || !geoapifyApiKey || !text.trim()) {
            setLoading(false);
            setOpen(false);
            return;
        }

        const request = requestRef.current;
        setLoading(true);
        setOpen(true);
        taskRef.current = setTimeout(() => {
            taskRef.current = null;
            const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
            url.searchParams.set("text", text);
            url.searchParams.set("format", "json");
            url.searchParams.set("limit", "10");
            url.searchParams.set("apiKey", geoapifyApiKey);
            const searchType = type === "citystate" ? "locality" : type;
            if (geoapifyTypes.includes(searchType)) url.searchParams.set("type", searchType);
            window.fetch(url.toString()).then(response => {
                if (!response.ok) throw Error(`Geoapify request failed: ${response.status}`);
                return response.json();
            }).then(({results}) => {
                if (request !== requestRef.current) return;
                const matches = Array.isArray(results) ? results : [];
                const filtered = type === "citystate"
                    ? matches.filter(result => result.result_type === "city" || result.result_type === "state")
                    : matches;
                const items = formatOptions(filtered, type);
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
        className={[selectStyles.menu, styles.menu].join(" ")}
        ref={menuRef}
        style={position}
    >
        <div id={listId.current} role={"listbox"}>
            {loading && <div className={styles.status} role={"status"}>{t("Common.Loading...")}</div>}
            {!loading && options.map((option, index) => <div
                aria-selected={index === activeIndex}
                className={selectStyles.menuItem}
                data-selected={index === activeIndex}
                id={`${listId.current}-option-${index}`}
                key={option.title}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerDown={event => event.preventDefault()}
                role={"option"}
            >{option.title}</div>)}
        </div>
        {!loading && options.length > 0 && <div className={styles.attribution} onPointerDown={event => event.preventDefault()}>
            <a href={"https://www.geoapify.com/"} rel={"noopener noreferrer"} target={"_blank"}>Powered by Geoapify</a>
            {" · "}
            <a href={"https://www.openstreetmap.org/copyright"} rel={"noopener noreferrer"} target={"_blank"}>© OpenStreetMap contributors</a>
        </div>}
    </div>, document.body);

    return <div className={[styles.root, fullWidth && styles.fullWidth].filter(Boolean).join(" ")} ref={anchorRef}>
        <TextField
            {...fieldProps}
            aria-activedescendant={open && activeIndex >= 0 ? `${listId.current}-option-${activeIndex}` : undefined}
            aria-autocomplete={"list"}
            aria-controls={open ? listId.current : undefined}
            aria-expanded={open}
            autoComplete={"off"}
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
