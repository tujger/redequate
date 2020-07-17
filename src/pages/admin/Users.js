import React from "react";
import Fab from "@material-ui/core/Fab";
import AddIcon from '@material-ui/icons/Add';
import {Link} from "react-router-dom";
import {connect, useDispatch} from "react-redux";
import {Clear} from "@material-ui/icons";
import IconButton from "@material-ui/core/IconButton";
import Input from "@material-ui/core/Input";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Toolbar from "@material-ui/core/Toolbar";
import {useTheme} from "@material-ui/core";
import LazyListComponent from "../../components/LazyListComponent";
import UserItemComponent from "../../components/UserItemComponent";
import Pagination from "../../controllers/FirebasePagination";
import {normalizeSortName, UserData, useUserDatas} from "../../controllers/UserData";
import {cacheDatas, useFirebase, usePages} from "../../controllers/General";
import ProgressView from "../../components/ProgressView";

const Users = (props) => {
    const {mode = "all", filter} = props;
    const pages = usePages();
    const userDatas = useUserDatas();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const theme = useTheme();

    const handleMode = evt => {
        // setState({...state, mode: evt.target.value});
        dispatch({type: LazyListComponent.RESET, cache: "users"});
        dispatch({type: Users.MODE, mode: evt.target.value, filter});
    }

    const handleFilter = evt => {
        dispatch({type: Users.MODE, filter: evt.target.value});
        dispatch({type: LazyListComponent.RESET, cache: "users"});
    }

    React.useEffect(() => {
        // dispatch(ProgressView.SHOW);
        return () => {
            dispatch({type: LazyListComponent.RESET, cache: "users"});
            dispatch(ProgressView.HIDE);
        }
// eslint-disable-next-line
    }, [mode]);

    let pagination;
    let itemTransform;
    switch (mode) {
        case "all":
            pagination = new UsersPagination({
                firebase: firebase,
                start: filter
            })
            itemTransform = item => item;
            break;
        case "admins":
            pagination = new Pagination({
                ref: firebase.database().ref("roles"),
                value: true,
                equals: "admin",
                size: 10
            })
            itemTransform = async (item) => {
                const data = await cacheDatas.put(item.key, UserData(firebase)).fetch(item.key);
                return {key: item.key, value: data};
            }
/*
            itemTransform = async (item) => {
                const data = await new UserData(firebase).fetch(item.key);
                return {key: item.key, value: data};
            }
*/
            break;
        case "disabled":
            pagination = new Pagination({
                ref: firebase.database().ref("roles"),
                value: true,
                equals: "disabled",
                size: 10
            })
            itemTransform = async (item) => {
                const data = await cacheDatas.put(item.key, UserData(firebase)).fetch(item.key);
                return {key: item.key, value: data};
            }
            break;
        case "notVerified":
            pagination = new Pagination({
                ref: firebase.database().ref("users_public"),
                child: "emailVerified",
                equals: false,
                size: 10
            })
            itemTransform = item => item;
        default:
    }

    return <React.Fragment>
        <Toolbar disableGutters>
            <Select
                color={"secondary"}
                onChange={handleMode}
                value={mode}
            >
                <MenuItem value={"all"}>All users</MenuItem>
                <MenuItem value={"admins"}>Administrators</MenuItem>
                <MenuItem value={"disabled"}>Disabled users</MenuItem>
                <MenuItem value={"notVerified"}>Users not verified</MenuItem>
            </Select>
            {mode === "all" && <Input
                autoFocus
                color={"secondary"}
                endAdornment={filter ? <IconButton
                    children={<Clear/>}
                    onClick={() => {
                        dispatch({type: Users.MODE, filter: ""});
                        dispatch({type: LazyListComponent.RESET, cache: "users"});
                    }}
                    size={"small"}
                    title={"Clear filter"}
                    variant={"text"}
                /> : null}
                onChange={handleFilter}
                placeholder={"Filter"}
                value={filter}
            />}
        </Toolbar>
        <LazyListComponent
            pagination={pagination}
            itemTransform={itemTransform}
            itemComponent={item => <UserItemComponent key={item.key} data={item}/>}
            placeholder={<UserItemComponent skeleton={true}/>}
            noItemsComponent={<UserItemComponent label={"No users found"}/>}
            cache={"users"}
        />
        {/*<ListComponent
            items={items}
            leftAction={listAction({
                action: (selectedItems) => {
                    throw Error("'left' is not implemented");
                },
                itemButton: {
                    label: "Check",
                    icon: <CheckIcon/>,
                    color: "#008800",
                },
                toolbarButton: {
                    label: "Check all",
                    icon: <CheckIcon/>,
                },
                variant: "warning"
            })}
            rightAction={listAction({
                action: (selectedItems) => {
                    dispatch(ProgressView.SHOW);
                    for(let item of selectedItems) {
                        let index = items.indexOf(item);
                        console.log("left", items.length, index, item);
                        items.splice(items.indexOf(item), 1);
                        notifySnackbar({title: "Removed: " + item.public.name});
                    }
                    setState({...state, items});
                    dispatch(ProgressView.HIDE);
                },
                itemButton: {
                    label: "Delete this",
                    icon: <DeleteIcon/>,
                    color: "#ff0000",
                },
                toolbarButton: {
                    label: "Delete all",
                    icon: <DeleteIcon/>,
                    ask: "You are going to delete all selected items. Continue?"
                },
                variant: "warning"
            })}
            emptyComponent={<ServiceComponent text={loading ? "Loading..." : "No users"}/>}
            itemComponent={<UserComponent pages={pages} store={store} firebase={firebase}/>}
        />*/}
        <Link to={pages.adduser.route}
              key={pages.adduser.route}>
            <Fab aria-label={"Add"} color={"secondary"}
                 style={{zIndex: 1, right: theme.spacing(2), bottom: theme.spacing(2), position: "fixed"}}>
                <AddIcon/>
            </Fab>
        </Link>
    </React.Fragment>
};

Users.MODE = "users_Mode";

export const usersReducer = (state = {filter: "", mode: "all"}, action) => {
    switch (action.type) {
        case Users.MODE:
            return {...state, filter: action.filter, mode: action.mode};
        default:
            return state;
    }
};
// gamesReducer.skipStore = true;

const mapStateToProps = ({usersReducer}) => ({
    filter: usersReducer.filter,
    mode: usersReducer.mode,
});

export default connect(mapStateToProps)(Users);

function UsersPagination({firebase, start}) {
    let count = 0, countTotal = 0, finished = false, started = true, names = [], emails = [],
        order = "asc", added = [];

    const maxItems = 10;

    const namesPagination = new Pagination({
        child: "_sort_name",
        ref: firebase.database().ref("users_public"),
        size: maxItems,
        start: normalizeSortName(start)
    });

    const emailsPagination = new Pagination({
        child: "email",
        ref: firebase.database().ref("users_public"),
        size: maxItems,
        start: start,
    });

    const next = async () => {
        started = true;

        names = await namesPagination.next();
        if (start) emails = await emailsPagination.next();
        else emails = [];

        const result = [];
        if (names.length) {
            names.forEach(item => {
                if (added.indexOf(item.key) >= 0) return;
                result.push(item);
                added.push(item.key);
            })
        }
        if (emails.length) {
            emails.forEach(item => {
                if (added.indexOf(item.key) >= 0) return;
                result.push(item);
                added.push(item.key);
            })
        }

        finished = namesPagination.finished && (start ? emailsPagination.finished : true);
        count = result.length;
        countTotal = added.length;
        return result;
    }

    const reset = async () => {
        firebase.database().goOnline();
        namesPagination.reset();
        emailsPagination.reset();
        countTotal = 0;
        count = 0;
        finished = false;
        started = false;
    }

    return {
        get count() {
            return count
        },
        get countTotal() {
            return countTotal
        },
        get finished() {
            return finished
        },
        get order() {
            return order;
        },
        get started() {
            return started
        },
        next: next,
        reset: reset,
    };
}
