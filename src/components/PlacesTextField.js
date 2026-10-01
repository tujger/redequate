import React from "react";
import {useTranslation} from "react-i18next";
import {useMetaInfo} from "../controllers/General";
import Menu from "../controls/Menu/Menu";
import SelectItem from "../controls/Select/SelectItem";
import TextField from "../controls/TextField/TextField";
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
    const listId = React.useRef(null);
    if (!listId.current) listId.current = `redequate-places-${++nextListId}`;
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);

    React.useEffect(() => {
        setOpen(false);
        setActiveIndex(-1);
    }, [disabled, type, geoapifyApiKey]);

    React.useEffect(() => {
        if (value) return;
        setOpen(false);
        setActiveIndex(-1);
    }, [value]);

    const closeMenu = () => {
        setOpen(false);
        setActiveIndex(-1);
    };

    const loadPlaces = React.useCallback(({signal}) => new Promise((resolve, reject) => {
        let timer;
        const abort = () => {
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
        };
        signal.addEventListener("abort", abort, {once: true});
        timer = setTimeout(async () => {
            const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
            url.searchParams.set("text", value);
            url.searchParams.set("format", "json");
            url.searchParams.set("limit", "10");
            url.searchParams.set("apiKey", geoapifyApiKey);
            const searchType = type === "citystate" ? "locality" : type;
            if (geoapifyTypes.includes(searchType)) url.searchParams.set("type", searchType);
            try {
                const response = await window.fetch(url.toString(), {signal});
                if (!response.ok) throw Error(`Geoapify request failed: ${response.status}`);
                const {results} = await response.json();
                const matches = Array.isArray(results) ? results : [];
                const filtered = type === "citystate"
                    ? matches.filter(result => result.result_type === "city" || result.result_type === "state")
                    : matches;
                resolve(formatOptions(filtered, type));
            } catch (error) {
                reject(error);
            } finally {
                signal.removeEventListener("abort", abort);
            }
        }, 500);
        if (signal.aborted) abort();
    }), [geoapifyApiKey, type, value]);

    const handleInputChange = event => {
        const text = event.target.value;
        setActiveIndex(-1);
        onChange?.(event, text);
        setOpen(!disabled && Boolean(geoapifyApiKey) && Boolean(text.trim()));
    };

    const handleSelect = option => {
        closeMenu();
        onChange?.({
            target: {name, value: option.title},
            persist: () => {},
        }, option);
    };

    const handleKeyDown = event => {
        givenOnKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;
        const visibleOptions = document.getElementById(listId.current)?.querySelectorAll('[role="option"]') || [];
        if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            closeMenu();
        } else if (event.key === "Tab" && open) {
            closeMenu();
        } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && visibleOptions.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => event.key === "ArrowDown"
                ? (index + 1) % visibleOptions.length
                : (index - 1 + visibleOptions.length) % visibleOptions.length);
        } else if (event.key === "Enter" && open && activeIndex >= 0 && activeIndex < visibleOptions.length) {
            event.preventDefault();
            visibleOptions[activeIndex].click();
        }
    };

    const menu = <Menu
        anchorEl={anchorRef}
        autoFocus={false}
        className={styles.menu}
        load={loadPlaces}
        matchAnchorWidth
        offset={4}
        onClose={closeMenu}
        onDisplayedOptionsChange={items => setActiveIndex(index => index < items.length ? index : -1)}
        onLoadError={closeMenu}
        onLoaded={items => { if (!items.length) closeMenu(); }}
        open={open}
        reloadKey={`${type}:${geoapifyApiKey}:${value}`}
        role={null}
        staleMs={1000}
    >
        {({options}) => <>
            <div id={listId.current} role={"listbox"}>
                {!options.length && <div className={styles.status} role={"status"}>{t("Common.Loading...")}</div>}
                {options.map((option, index) => <SelectItem
                aria-selected={index === activeIndex}
                data-selected={index === activeIndex}
                id={`${listId.current}-option-${index}`}
                key={option.title}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setActiveIndex(index)}
                onPointerDown={event => event.preventDefault()}
                role={"option"}
                >{option.title}</SelectItem>)}
            </div>
            {options.length > 0 && <div className={styles.attribution} onPointerDown={event => event.preventDefault()}>
                <a href={"https://www.geoapify.com/"} rel={"noopener noreferrer"} target={"_blank"}>Powered by Geoapify</a>
                {" · "}
                <a href={"https://www.openstreetmap.org/copyright"} rel={"noopener noreferrer"} target={"_blank"}>© OpenStreetMap contributors</a>
            </div>}
        </>}
    </Menu>;

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
                if (!disabled && geoapifyApiKey && String(value).trim()) setOpen(true);
                onFocus?.(event);
            }}
            onKeyDown={handleKeyDown}
            role={"combobox"}
            value={value ?? ""}
        />
        {menu}
    </div>;
};
