import BackIcon from "@material-ui/icons/ArrowBack";
import React from "react";
import {useTranslation} from "react-i18next";
import {useHistory} from "react-router-dom";
import {usePages} from "../../controllers/General";
import Button from "../../controls/Button/Button";
import TextField from "../../controls/TextField/TextField";
import styles from "./styles/SearchToolbar.module.css";

export default ({Input, open = false, onOpen, transformSearch}) => {
    const pages = usePages();
    const history = useHistory();
    const {t} = useTranslation();
    const [search, setSearch] = React.useState(open);
    const [searchValue, setSearchValue] = React.useState("");
    const unblockRef = React.useRef(null);

    const releaseBlock = React.useCallback(() => {
        const unblock = unblockRef.current;
        if (!unblock) return;
        unblockRef.current = null;
        if (history.unblock === unblock) delete history.unblock;
        unblock();
    }, [history]);

    React.useEffect(() => {
        setSearch(open);
        if (!open) releaseBlock();
    }, [open, releaseBlock]);

    React.useEffect(() => () => releaseBlock(), [releaseBlock]);

    const closeSearch = () => {
        setSearch(false);
        releaseBlock();
    };

    const handleOpen = () => {
        releaseBlock();
        const unblock = history.block(() => {
            closeSearch();
            return false;
        });
        unblockRef.current = unblock;
        history.unblock = unblock;
        setSearch(true);
        onOpen?.();
    };

    const handleSearch = () => {
        if (!searchValue) return;
        closeSearch();
        if (Input?.props.onApply) Input.props.onApply(searchValue);
        else history.push(pages.search.route + "?q=" + encodeURIComponent(searchValue));
    };

    const handleChange = event => {
        let value = event.target?.value ?? event.currentTarget?.value;
        if (transformSearch) value = transformSearch(value);
        setSearchValue(value);
        Input?.props.onChange?.(value);
    };

    const handleKeyUp = event => {
        if (event.key === "Escape") closeSearch();
        else if (event.key === "Enter") handleSearch();
    };

    const inputProps = {
        autoFocus: true,
        className: styles.input,
        color: "secondary",
        fullWidth: true,
        onKeyUp: handleKeyUp,
        placeholder: t("Search.Search"),
        value: searchValue,
    };

    const input = Input
        ? React.cloneElement(Input, {
            ...inputProps,
            ...Input.props,
            onChange: handleChange
        })
        : <TextField
            {...inputProps}
            onChange={handleChange}
        />

    return <>
        <Button
            color={"inherit"}
            icon={pages.search.icon}
            onClick={handleOpen}
            size={"large"}
            title={t("Search.Search")}
        />
        {search && <div className={styles.toolbar}>
            <Button
                color={"inherit"}
                icon={<BackIcon/>}
                onClick={closeSearch}
                size={"large"}
                title={t("Common.Cancel")}
            />
            {input}
            <Button
                color={"inherit"}
                icon={pages.search.icon}
                onClick={handleSearch}
                size={"large"}
                title={t("Search.Search")}
            />
        </div>}
    </>;
}
