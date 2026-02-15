import React from "react";
import {IconButton} from "@mui/material";
import BackIcon from "@mui/icons-material/ArrowBack";
import {useHistory} from "react-router-dom";
import {Toolbar} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import {Input as InputOrigin} from "@mui/material";
import {useTranslation} from "react-i18next";
import {usePages} from "../../controllers/General";
import styles from './styles/Search.module.css'

export default (
    {
        open = false,
        onOpen,
        transformSearch,
        onChange,
        Input = <InputOrigin/>
    }) => {
    const pages = usePages();
    const history = useHistory();
    const [state, setState] = React.useState({});
    const {search = open, searchValue = "", unblock} = state;
    const inputRef = React.useRef();
    const {t} = useTranslation();

    const closeSearch = () => {
        setState(state => ({...state, search: false, unblock: null}));
        unblock();
    }

    const handleSearch = () => {
        if (!searchValue) return;
        closeSearch();
        if (Input.props.onApply) {
            Input.props.onApply(searchValue);
        } else {
            history.push(pages.search?.route + "?q=" + encodeURIComponent(searchValue));
        }
    }

    React.useEffect(() => {
        setState(state => ({...state, search: open}));
    }, [open])

    return <>
        <IconButton
            className={styles.searchIcon}
            children={pages.search?.icon}
            onClick={() => {
                const unblock = history.block(() => {
                    setState(state => ({...state, search: false, unblock: null}));
                    unblock();
                    delete history.unblock;
                    return false;
                })
                history.unblock = unblock;
                setState({...state, search: true, unblock})
                onOpen && onOpen();
            }}
            title={t("Search.Search")}
            variant={"text"}
        />
        {search && <>
            <Toolbar color={"secondary"} className={styles.searchToolbar}>
                <IconButton
                    children={<BackIcon/>}
                    className={styles.searchToolbarBack}
                    color={"inherit"}
                    edge={"start"}
                    onClick={closeSearch}
                    title={t("Common.Cancel")}
                />
                <Input.type
                    autoFocus={true}
                    className={styles.searchToolbarInput}
                    color={"secondary"}
                    endAdornment={<IconButton
                        children={<ClearIcon/>}
                        className={styles.searchClearIcon}
                        onClick={() => {
                            setState({...state, searchValue: ""});
                            inputRef.current && inputRef.current.focus();
                            Input.props.onChange && Input.props.onChange("");
                        }}
                        title={t("Common.Clear")}
                        variant={"text"}
                    />}
                    fullWidth
                    onKeyUp={evt => {
                        if (evt && evt.key === "Escape") closeSearch();
                        else if (evt && evt.key === "Enter") handleSearch();
                        // if(open) {
                        //     Input.props.onKeyUp && Input.props.onKeyUp(evt);
                        // }
                    }}
                    placeholder={t("Search.Search")}
                    inputRef={inputRef}
                    value={searchValue}
                    {...Input.props}
                    onChange={evt => {
                        let searchValue = (evt.currentTarget || evt.target).value;
                        if (transformSearch) searchValue = transformSearch(searchValue);
                        setState({...state, searchValue});
                        Input.props.onChange && Input.props.onChange(searchValue);
                    }}
                />
                <IconButton
                    children={pages.search?.icon}
                    className={styles.searchToolbarIcon}
                    onClick={handleSearch}
                    title={t("Search.Search")}
                    variant={"text"}
                />
            </Toolbar>
        </>}
    </>
}
