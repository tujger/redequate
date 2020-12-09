import React from "react";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import {useHistory} from "react-router-dom";
import Toolbar from "@material-ui/core/Toolbar";
import ClearIcon from "@material-ui/icons/Clear";
import InputOrigin from "@material-ui/core/Input";
import {usePages} from "../../controllers/General";

export default (
    {
        classes,
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
            history.push(pages.search.route + "?q=" + encodeURIComponent(searchValue));
        }
    }

    React.useEffect(() => {
        setState(state => ({...state, search: open}));
    }, [open])

    return <>
        <IconButton
            className={classes.searchIcon}
            children={pages.search.icon}
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
            title={"Search"}
            variant={"text"}
        />
        {search && <>
            <Toolbar color={"secondary"} className={classes.searchToolbar}>
                <IconButton
                    children={<BackIcon/>}
                    className={classes.searchToolbarBack}
                    color={"inherit"}
                    edge={"start"}
                    onClick={closeSearch}
                    title={"Cancel search"}
                />
                <Input.type
                    autoFocus={true}
                    className={classes.searchToolbarInput}
                    color={"secondary"}
                    endAdornment={<IconButton
                        children={<ClearIcon/>}
                        className={classes.searchClearIcon}
                        onClick={() => {
                            setState({...state, searchValue: ""});
                            inputRef.current && inputRef.current.focus();
                            Input.props.onChange && Input.props.onChange("");
                        }}
                        title={"Clear search"}
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
                    placeholder={"Search"}
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
                    children={pages.search.icon}
                    className={classes.searchToolbarIcon}
                    onClick={handleSearch}
                    title={"Search"}
                    variant={"text"}
                />
            </Toolbar>
        </>}
    </>
}
