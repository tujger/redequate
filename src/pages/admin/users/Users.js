import React from "react";
import {Link} from "react-router-dom";
import {connect, useDispatch} from "react-redux";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import UserItem from "./UserItem";
import Pagination from "../../../controllers/FirebasePagination";
import {UserData} from "../../../controllers/UserData";
import {usePages} from "../../../controllers/General";
import ProgressView from "../../../components/ProgressView";
import {usersReducer} from "./usersReducer";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import AllUsersPagination from "./AllUsersPagination";
import UsersHeader from "./UsersHeader";
import FlexFabComponent from "../../../components/FlexFabComponent";
import userStyles from "./styles/Users.module.css";

function Users(props) {
    // eslint-disable-next-line react/prop-types
    const {classes: givenClasses, mode = "all", filter = "", invitation = true} = props;
    const classes = {...userStyles, ...(givenClasses || {})};
    const pages = usePages();
    const dispatch = useDispatch();

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
        // const data = await cacheDatas.put(item.key, UserData(firebase)).fetch(item.key, [UserData.PUBLIC, UserData.ROLE]);
        const data = await UserData().fetch(item.key, [UserData.PUBLIC, UserData.ROLE]);
        return {key: item.key, value: data};
    }

    let pagination;
    let itemTransform;
    switch (mode) {
        case "active":
            pagination = new Pagination({
                ref: "users_public",
                child: "visit",
                start: 0,
                order: "desc",
            })
            itemTransform = async item => {
                const res = await fetchUserData(item);
                res._date = res.value && res.value.public && res.value.public.visit;
                return res;
            }
            break;
        case "admins":
            pagination = new Pagination({
                ref: "roles",
                value: true,
                equals: "admin",
            })
            itemTransform = item => fetchUserData(item);
            break;
        case "disabled":
            pagination = new Pagination({
                ref: "roles",
                value: true,
                equals: "disabled",
            })
            itemTransform = item => fetchUserData(item);
            break;
        case "notVerified":
            pagination = new Pagination({
                ref: "users_public",
                child: "emailVerified",
                equals: false,
            })
            itemTransform = item => fetchUserData(item);
            break;
        case "recent":
            pagination = new Pagination({
                ref: "users_public",
                child: "created",
                start: 0,
                order: "desc",
            })
            itemTransform = item => fetchUserData(item);
            break;
        case "all":
        default:
            pagination = new AllUsersPagination({
                start: filter
            })
            itemTransform = item => fetchUserData(item);
            break;
    }

    return <>
        <UsersHeader classes={classes} filter={filter} handleChange={handleHeaderChange} mode={mode}/>
        <div className={classes.center}>
            <LazyListComponent
                pagination={pagination}
                itemTransform={itemTransform}
                itemComponent={item => <UserItem key={item.key} data={item}/>}
                placeholder={<UserItem skeleton={true}/>}
                noItemsComponent={<UserItem label={"No users found"}/>}
            />
        </div>
        {invitation && <Link to={pages.adduser.route}>
            <FlexFabComponent
                icon={<span className={classes.addIcon} aria-hidden='true'>+</span>}
                label={"Add user"}
            />
        </Link>}
    </>
}

const mapStateToProps = ({users}) => ({
    filter: users.filter,
    mode: users.mode,
});

export default connect(mapStateToProps)(Users);
