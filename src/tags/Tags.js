import AddIcon from "@mui/icons-material/Add";
import React from "react";
import {useTranslation} from "react-i18next";
import {connect, useDispatch} from "react-redux";
import {Link} from "react-router-dom";
import FlexFabComponent from "../components/FlexFabComponent";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import MentionedTextComponent from "../components/MentionedTextComponent";
import MutualSubscribeItem from "../components/MutualComponent/MutualSubscribeItem";
import NavigationToolbar from "../components/NavigationToolbar";
import Pagination from "../controllers/FirebasePagination";
import {usePages} from "../controllers/General";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import {normalizeSortName} from "../controllers/UserData";
import Select from "../controls/Select/Select";
import TextField from "../controls/TextField/TextField";
import baseStyles from "../themes/Base.module.css";
import {tagsReducer} from "./tagsReducer";

const Tags = (props) => {
    const {
        forceMode,
        mode: inheritMode = "all",
        filter,
        equals,
        fabLabel = "Add tag",
        noItemsCoponent = <ItemPlaceholderComponent skeleton={true} pattern={"flat"} label={"No tags found"}/>,
        ItemProps = {counter: true}
    } = props;
    const dispatch = useDispatch();
    const pages = usePages();
    const mode = forceMode || inheritMode;
    const {t} = useTranslation();

    const itemComponent = item => {
        return <MutualSubscribeItem
            {...ItemProps}
            counter={true}
            key={item.key}
            data={item}
            type={"tag"}
            typeId={"watching"}
            unsubscribeLabel={null}
        />
    }

    const handleMode = evt => {
        dispatch({type: tagsReducer.MODE, mode: evt.target.value, filter});
    }

    const handleFilter = evt => {
        // setState({...state, filter: evt.target.value})
        dispatch({type: tagsReducer.MODE, mode, filter: evt.target.value});
    }

    const modeOptions = [
        {label: "All", value: "all"},
        {label: "Hidden", value: "hidden"},
    ];

    const handleClearFilter = () => {
        dispatch({type: tagsReducer.MODE, mode, filter: ""});
    };

    React.useEffect(() => {
        return () => {
            dispatch({type: lazyListComponentReducer.RESET});
        }
        // eslint-disable-next-line
    }, [mode, filter]);

    let paginationOptions;
    let itemTransform = item => {
        return {
            key: item.key,
            value: {
                ...item.value,
                message: <MentionedTextComponent
                    maxLength={25}
                    mentions={[mentionTags, mentionUsers]}
                    text={item.value.description || null}
                />,
                timestamp: null,
            },
            userData: {
                image: item.value.image,
                initials: item.value.label || item.value.id,
                name: item.value.label || item.value.id,
            }
        }
    };
    switch (mode) {
        case "all":
            paginationOptions = {
                ref: "tag",
                child: "_sort_name",
                equals: equals,
            };
            if (filter && !equals) {
                paginationOptions.start = normalizeSortName(filter);
                paginationOptions.end = normalizeSortName(filter) + "\uf8ff";
            }
            break;
        case "hidden":
            paginationOptions = {
                ref: "tag",
                child: "hidden",
                equals: true,
            }
            break;
        case "uid":
            paginationOptions = {
                ref: "tag",
                child: "uid",
                equals: equals,
            }
            if (filter && !equals) {
                paginationOptions.start = normalizeSortName(filter);
                paginationOptions.end = normalizeSortName(filter) + "\uf8ff";
            }
            break;
        default:
            break;
    }
    return <>
        <NavigationToolbar backButton={null}>
            <Select
                color={"secondary"}
                onChange={handleMode}
                options={modeOptions}
                value={mode}
            />
            {mode === "all" && <TextField
                onChange={handleFilter}
                placeholder={"Search"}
                value={filter}
            />}
        </NavigationToolbar>
        <div className={baseStyles.content}>
            <LazyListComponent
                itemComponent={itemComponent}
                itemTransform={itemTransform}
                pagination={() => new Pagination(paginationOptions)}
                noItemsComponent={noItemsCoponent}
                placeholder={<ItemPlaceholderComponent skeleton={true} pattern={"flat"}/>}
                ItemProps={{
                    counter: true
                }}
            />
        </div>
        <Link
            to={pages.newtag.route}
            key={pages.newtag.route}>
            <FlexFabComponent
                icon={<AddIcon/>}
                label={fabLabel}
            />
        </Link>
    </>
};

const mapStateToProps = ({tags}) => ({
    mode: tags.mode,
    filter: tags.filter,
});

export default connect(mapStateToProps)(Tags);
