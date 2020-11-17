import React from "react";
import {Link} from "react-router-dom";
import {connect, useDispatch} from "react-redux";
import withStyles from "@material-ui/styles/withStyles";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Input from "@material-ui/core/Input";
import IconButton from "@material-ui/core/IconButton";
import Clear from "@material-ui/icons/Clear";
import Fab from "@material-ui/core/Fab";
import AddIcon from "@material-ui/icons/Add";
import Hidden from "@material-ui/core/Hidden";
import Grid from "@material-ui/core/Grid";
import {useFirebase} from "../../controllers/General";
import TagItem from "../../components/TagItem";
import {lazyListComponentReducer} from "../../components/LazyListComponent/lazyListComponentReducer";
import ProgressView from "../../components/ProgressView";
import {normalizeSortName} from "../../controllers/UserData";
import NavigationToolbar from "../../components/NavigationToolbar";
import LazyListComponent from "../../components/LazyListComponent/LazyListComponent";
import Pagination from "../../controllers/FirebasePagination";
import {usePages} from "../../controllers/General";
import {styles} from "../../controllers/Theme";

const GamesList = ({classes, mode, filter}) => {
    const firebase = useFirebase();
    const dispatch = useDispatch();

    const itemComponent = item => <TagItem key={item.key} data={item.value}/>

    const handleMode = evt => {
        // setState({...state, mode: evt.target.value});
        // dispatch({type: gamesReducer.MODE, mode: evt.target.value, filter});
    }

    const handleFilter = evt => {
        // setState({...state, filter: evt.target.value})
        // dispatch({type: gamesReducer.MODE, mode, filter: evt.target.value});
        dispatch({type: lazyListComponentReducer.RESET});
    }

    React.useEffect(() => {
        return () => {
            dispatch(ProgressView.HIDE);
            dispatch({type: lazyListComponentReducer.RESET});
        }
        // eslint-disable-next-line
    }, [mode]);

    let paginationOptions;
    let itemTransform;
    switch (mode) {
        default:
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
        // case "hidden":
        //     paginationOptions = {
        //         ref: firebase.database().ref("tag"),
        //         child: "hidden",
        //         equals: true,
        //     }
        //     itemTransform = item => cacheDatas.put(item.key, GameData(firebase)).fetch(item.key)
        //     break;
        // case "score":
        //     paginationOptions = {
        //         ref: firebase.database().ref("_game_scores"),
        //         child: "score",
        //         order: "desc",
        //     }
        //     itemTransform = item => cacheDatas.put(item.key, GameData(firebase)).fetch(item.key);
        //     break;
    }

    return <React.Fragment>
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
        </Hidden>
        <Grid container className={classes.center}>
            <LazyListComponent
                itemComponent={itemComponent}
                itemTransform={itemTransform}
                pagination={() => new Pagination(paginationOptions)}
                noItemsComponent={<TagItem skeleton={true} label={"No games found"}/>}
                placeholder={<TagItem skeleton={true}/>}
                // reverse
            />
        </Grid>
    </React.Fragment>
};

const Tags = (props) => {
    const pages = usePages();
    const {classes} = props;

    return <>
        <GamesList {...props} classes={classes}/>
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
        {/*{<Link to={pages.newgame.route}*/}
        {/*       key={pages.newgame.route}>*/}
        {/*    <Fab aria-label={"Add game"} color={"primary"} className={classes.fab}>*/}
        {/*        <AddIcon/>*/}
        {/*    </Fab>*/}
        {/*</Link>}*/}
    </>
};

const mapStateToProps = ({gamesReducer}) => ({
    mode: gamesReducer.mode,
    filter: gamesReducer.filter,
});

export default connect(mapStateToProps)(withStyles(styles)(Tags));
