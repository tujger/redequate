import AddIcon from "@mui/icons-material/Add";
import React from "react";
import {connect, useDispatch} from "react-redux";
import {Link} from "react-router-dom";
import {DatabaseOrder} from "../../../../packages/database/src";
import FlexFabComponent from "../../../components/FlexFabComponent";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import LoadingComponent from "../../../components/LoadingComponent";
import ProgressView from "../../../components/ProgressView";
import {cacheDatas, useDatabase, useRedirectToLogin} from "../../../controllers";
import {usePages} from "../../../controllers/General";
import {normalizeSortName, UserData} from "../../../controllers/UserData";
import baseStyles from "../../../themes/Base.module.css";
import UserItem from "./UserItem";
import UsersHeader from "./UsersHeader";
import {usersReducer} from "./usersReducer";

function Users(props) {
    const {mode = "all", filter = "", invitation = true} = props;
    const database = useDatabase();
    const dispatch = useDispatch();
    const pages = usePages();
    const shouldRedirectToLogin = useRedirectToLogin();

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
        return () => {
            dispatch(ProgressView.HIDE);
        }
    }, [mode]);

    if (shouldRedirectToLogin) return <LoadingComponent/>;

    const fetchUserData = async item => {
        const data = await cacheDatas.fetch(item.key, id => {
            return new UserData(database).fetch(id, [UserData.NAME, UserData.IMAGE, UserData.PUBLIC, UserData.ROLE]);
        });
        const _date = data.value?.public?.visit;
        return {key: item.key, value: data, _date};
    }

    const itemTransform = async item => {
        return ({
            children: JSON.stringify(item),
            data: await fetchUserData(item)
        });
    };

    let cursor;
    switch (mode) {
        case "active":
            cursor = database.cursor(["users_public"], {
                order: DatabaseOrder.DESC,
                orderBy: ["visit"],
                start: 0,
                end: Number.MAX_SAFE_INTEGER,
            });
            break;
        case "admins":
            cursor = database.cursor(["roles"], {
                equalTo: "admin"
            });
            break;
        case "disabled":
            cursor = database.cursor(["roles"], {
                equalTo: "disabled"
            });
            break;
        case "notVerified":
            cursor = database.cursor(["users_public"], {
                equalTo: false,
                orderBy: ["emailVerified"],
            });
            break;
        case "recent":
            cursor = database.cursor(["users_public"], {
                order: DatabaseOrder.DESC,
                orderBy: ["created"],
                start: 0,
            });
            break;
        case "all":
        default:
            cursor = database.cursor([
                {path: ["users_public"], orderBy: ["_sort_name"], start: normalizeSortName(filter)},
                ...(filter ? [{path: ["users_public"], orderBy: [UserData.EMAIL], start: filter}] : []),
            ]);
            break;
    }

    return <>
        <UsersHeader filter={filter} handleChange={handleHeaderChange} mode={mode}/>
        <div className={[baseStyles.content].join(" ")}>
            <LazyListComponent
                cursor={cursor}
                itemTransform={itemTransform}
                ItemComponent={UserItem}
                page={25}
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
