import React from "react";
import Fab from "@material-ui/core/Fab";
import AddIcon from "@material-ui/icons/Add";
import {Link} from "react-router-dom";
import {connect, useDispatch} from "react-redux";
import Grid from "@material-ui/core/Grid";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import UserItem from "./UserItem";
import Pagination from "../../../controllers/FirebasePagination";
import {UserData} from "../../../controllers/UserData";
import {cacheDatas, useFirebase, usePages} from "../../../controllers/General";
import ProgressView from "../../../components/ProgressView";
import {styles} from "../../../controllers/Theme";
import withStyles from "@material-ui/styles/withStyles";
import {usersReducer} from "./usersReducer";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import AllUsersPagination from "./AllUsersPagination";
import UsersHeader from "./UsersHeader";

function Users(props) {
    // eslint-disable-next-line react/prop-types
    const {classes, mode = "all", filter, invitation = true} = props;
    const pages = usePages();
    const dispatch = useDispatch();
    const firebase = useFirebase();

    const handleHeaderChange = type => evt => {
        if (type === "clear") {
            dispatch({type: usersReducer.MODE, filter: ""});
        } else if (type === "filter") {
            dispatch({type: usersReducer.MODE, mode, filter: evt.target.value});
        } else if (type === "mode") {
            dispatch({type: usersReducer.MODE, mode: evt.target.value});
        }
        dispatch({type: lazyListComponentReducer.RESET});
    }

    React.useEffect(() => {
        // dispatch(ProgressView.SHOW);
        return () => {
            dispatch(ProgressView.HIDE);
        }
        // eslint-disable-next-line
    }, [mode]);

    const fetchUserData = async item => {
        const data = await cacheDatas.put(item.key, UserData(firebase)).fetch(item.key, [UserData.PUBLIC, UserData.ROLE]);
        return {key: item.key, value: data};
    }

    let pagination;
    let itemTransform;
    switch (mode) {
        case "active":
            pagination = new Pagination({
                ref: firebase.database().ref("users_public"),
                child: "lastLogin",
                order: "desc",
            })
            itemTransform = async item => {
                const res = await fetchUserData(item);
                res._date = res.value && res.value.public && res.value.public.lastLogin;
                return res;
            }
            break;
        case "admins":
            pagination = new Pagination({
                ref: firebase.database().ref("roles"),
                value: true,
                equals: "admin",
            })
            itemTransform = item => fetchUserData(item);
            break;
        case "disabled":
            pagination = new Pagination({
                ref: firebase.database().ref("roles"),
                value: true,
                equals: "disabled",
            })
            itemTransform = item => fetchUserData(item);
            break;
        case "notVerified":
            pagination = new Pagination({
                ref: firebase.database().ref("users_public"),
                child: "emailVerified",
                equals: false,
            })
            itemTransform = item => fetchUserData(item);
            break;
        case "recent":
            pagination = new Pagination({
                ref: firebase.database().ref("users_public"),
                child: "created",
                order: "desc",
            })
            itemTransform = item => fetchUserData(item);
            break;
        case "all":
        default:
            pagination = new AllUsersPagination({
                firebase: firebase,
                start: filter
            })
            itemTransform = item => fetchUserData(item);
            break;
    }

    return <>
        <UsersHeader classes={classes} filter={filter} handleChange={handleHeaderChange} mode={mode}/>
        <Grid container className={classes.center}>
            <LazyListComponent
                className={classes.center}
                pagination={pagination}
                itemTransform={itemTransform}
                itemComponent={item => <UserItem key={item.key} data={item}/>}
                placeholder={<UserItem skeleton={true}/>}
                noItemsComponent={<UserItem label={"No users found"}/>}
            />
        </Grid>
        {/* <ListComponent
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
        /> */}
        {invitation && <Link
            key={pages.adduser.route}
            to={pages.adduser.route}
        >
            <Fab aria-label={"Add"} color={"primary"} className={classes.fab}>
                <AddIcon/>
            </Fab>
        </Link>}
    </>
}

const mapStateToProps = ({users}) => ({
    filter: users.filter,
    mode: users.mode,
});

export default connect(mapStateToProps)(withStyles(styles)(Users));
