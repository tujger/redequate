import React from "react";
import {connect, useDispatch} from "react-redux";
import withStyles from "@material-ui/styles/withStyles";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Input from "@material-ui/core/Input";
import IconButton from "@material-ui/core/IconButton";
import Clear from "@material-ui/icons/Clear";
import AddIcon from "@material-ui/icons/Add";
import Fab from "@material-ui/core/Fab";
import Hidden from "@material-ui/core/Hidden";
import Grid from "@material-ui/core/Grid";
import {useFirebase, usePages} from "../controllers/General";
import TagItem from "./TagItem";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import {normalizeSortName} from "../controllers/UserData";
import NavigationToolbar from "../components/NavigationToolbar";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import Pagination from "../controllers/FirebasePagination";
import {styles} from "../controllers/Theme";
import {tagsReducer} from "./tagsReducer";
import {Link} from "react-router-dom";

const Tags = ({classes, mode = "all", filter}) => {
    const firebase = useFirebase();
    const dispatch = useDispatch();
    const pages = usePages();

    const itemComponent = item => <TagItem key={item.key} data={item}/>

    const handleMode = evt => {
        dispatch({type: tagsReducer.MODE, mode: evt.target.value, filter});
    }

    const handleFilter = evt => {
        // setState({...state, filter: evt.target.value})
        dispatch({type: tagsReducer.MODE, mode, filter: evt.target.value});
    }

    React.useEffect(() => {
        return () => {
            dispatch({type: lazyListComponentReducer.RESET});
        }
        // eslint-disable-next-line
    }, [mode, filter]);

    let paginationOptions;
    let itemTransform;
    switch (mode) {
        case "all":
            paginationOptions = {
                ref: firebase.database().ref("tag"),
                child: "_sort_name",
            };
            if (filter) {
                paginationOptions.start = normalizeSortName(filter);
                paginationOptions.end = normalizeSortName(filter) + "\uf8ff";
            }
            itemTransform = item => item;
            break;
        case "hidden":
            paginationOptions = {
                ref: firebase.database().ref("tag"),
                child: "hidden",
                equals: true,
            }
            itemTransform = item => item;
            break;
        default:
            break;
    }

    return <>
        <Hidden smDown>
            <NavigationToolbar
                backButton={null}
                className={classes.topSticky}
            >
                <Select
                    color={"secondary"}
                    onChange={handleMode}
                    value={mode}
                >
                    <MenuItem value={"all"}>All tags</MenuItem>
                    <MenuItem value={"hidden"}>Hidden tags</MenuItem>
                </Select>
                {mode === "all" ? <Input
                    color={"secondary"}
                    endAdornment={filter ? <IconButton
                        children={<Clear/>}
                        onClick={() => {
                            dispatch({type: tagsReducer.MODE, mode, filter: ""});
                        }}
                        title={"Clear"}
                        variant={"text"}
                        size={"small"}
                    /> : null}
                    onChange={handleFilter}
                    placeholder={"Search"}
                    value={filter}
                /> : null}
            </NavigationToolbar>
        </Hidden>
        <Hidden mdUp>
            <NavigationToolbar
                backButton={null}
                className={classes.topSticky}
                rightButton={<Select
                    color={"secondary"}
                    onChange={handleMode}
                    value={mode}
                >
                    <MenuItem value={"all"}>All tags</MenuItem>
                    <MenuItem value={"hidden"}>Hidden tags</MenuItem>
                </Select>}
            >
                {mode === "all" ? <Input
                    color={"secondary"}
                    endAdornment={filter ? <IconButton
                        children={<Clear/>}
                        onClick={() => {
                            dispatch({type: tagsReducer.MODE, mode, filter: ""});
                        }}
                        title={"Clear"}
                        variant={"text"}
                        size={"small"}
                    /> : null}
                    onChange={handleFilter}
                    placeholder={"Search"}
                    value={filter}
                /> : null}
            </NavigationToolbar>
        </Hidden>
        <Grid container className={classes.center}>
            <LazyListComponent
                itemComponent={itemComponent}
                itemTransform={itemTransform}
                pagination={() => new Pagination(paginationOptions)}
                noItemsComponent={<TagItem skeleton={true} label={"No tags found"}/>}
                placeholder={<TagItem skeleton={true}/>}
                // reverse
            />
        </Grid>
        {/*<Hidden smDown>
            <NavigationToolbar
                backButton={null}
                className={classes.topSticky}
            >
                <Select
                    color={"secondary"}
                    onChange={handleMode}
                    value={mode}
                >
                    <MenuItem value={"all"}>All games</MenuItem>
                    <MenuItem value={"score"}>Games with score</MenuItem>
                    <MenuItem value={"hidden"}>Hidden games</MenuItem>
                </Select>
                {mode === "all" ? <Input
                    color={"secondary"}
                    endAdornment={filter ? <IconButton
                        children={<Clear/>}
                        onClick={() => {
                            dispatch({type: gamesReducer.MODE, mode, filter: ""});
                            // setState({...state, filter: ""});
                        }}
                        title={"Clear"}
                        variant={"text"}
                        size={"small"}
                    /> : null}
                    onChange={handleFilter}
                    placeholder={"Search"}
                    value={filter}
                /> : null}
            </NavigationToolbar>
        </Hidden>
        <Hidden mdUp>
            <NavigationToolbar
                backButton={null}
                className={classes.topSticky}
                rightButton={<Select
                    color={"secondary"}
                    onChange={handleMode}
                    value={mode}
                >
                    <MenuItem value={"all"}>All games</MenuItem>
                    <MenuItem value={"score"}>Games with score</MenuItem>
                    <MenuItem value={"hidden"}>Hidden games</MenuItem>
                </Select>}
            >
                {mode === "all" ? <Input
                    color={"secondary"}
                    endAdornment={filter ? <IconButton
                        children={<Clear/>}
                        onClick={() => {
                            dispatch({type: gamesReducer.MODE, mode, filter: ""});
                            // setState({...state, filter: ""});
                        }}
                        title={"Clear"}
                        variant={"text"}
                        size={"small"}
                    /> : null}
                    onChange={handleFilter}
                    placeholder={"Search"}
                    value={filter}
                /> : null}
            </NavigationToolbar>
        </Hidden>*/}
        <Link
            to={pages.newtag.route}
            key={pages.newtag.route}>
            <Fab aria-label={"Add game"} color={"primary"} className={classes.fab}>
                <AddIcon/>
            </Fab>
        </Link>
    </>
};

const mapStateToProps = ({tags}) => ({
    mode: tags.mode,
    filter: tags.filter,
});

export default connect(mapStateToProps)(withStyles(styles)(Tags));
