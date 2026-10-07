import AddIcon from "@mui/icons-material/Add";
import React from "react";
import {connect, useDispatch} from "react-redux";
import {Link} from "react-router-dom";
import FlexFabComponent from "../../../components/FlexFabComponent";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import ProgressView from "../../../components/ProgressView";
import Pagination from "../../../controllers/FirebasePagination";
import {usePages} from "../../../controllers/General";
import {UserData} from "../../../controllers/UserData";
import baseStyles from "../../../themes/Base.module.css";
import AllUsersPagination from "./AllUsersPagination";
import UserItem from "./UserItem";
import UsersHeader from "./UsersHeader";
import {usersReducer} from "./usersReducer";

function Users(props) {
    // eslint-disable-next-line react/prop-types
    const {mode = "all", filter = "", invitation = true} = props;
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
        <UsersHeader filter={filter} handleChange={handleHeaderChange} mode={mode}/>
        <div className={[baseStyles.content].join(" ")}>
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
                icon={<AddIcon/>}
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
