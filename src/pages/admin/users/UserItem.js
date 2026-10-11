import React from "react";
import {useHistory} from "react-router-dom";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import ListItemComponent from "../../../components/ListItemComponent";
import {usePages} from "../../../controllers/General";
import UserName from "../../../controls/UserName/UserName";
import userStyles from "./styles/UserItem.module.css";

export default ({data, skeleton, label}) => {
    const history = useHistory();
    const pages = usePages()

    const {value: userData, _date} = data || {};

    if (label) {
        return <ItemPlaceholderComponent classes={userStyles} label={label} pattern={"flat"}/>;
    }

    if (skeleton) {
        return <ItemPlaceholderComponent classes={userStyles} pattern={"flat"}/>;
    }

    const handleClick = () => {
        history.push(pages.user.route + userData.id);
    };

    const handleKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleClick();
    };

    return <ListItemComponent
        avatar={<AvatarView
            className={[
                userData.role === "userNotVerified" ? userStyles.notVerified : "",
                userData.role === "admin" ? userStyles.admin : "",
                userData.role === "disabled" ? userStyles.disabled : "",
            ].join(" ")}
            image={userData.image}
            initials={userData.initials}
            verified={true}
        />}
        timestamp={_date || userData.public.created}
        title={<UserName id={userData.id}>
            {userData.email}
        </UserName>}
        menu={userData.public && <div className={userStyles.cardAction}>
            {userData.public.provider}
        </div>}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
    >
        {userData.name}<br/>
        {userData.public.address}
    </ListItemComponent>
}
