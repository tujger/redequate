import React from "react";
import {useHistory} from "react-router-dom";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import UserName from "../../../controls/UserName/UserName";
import {toDateString} from "../../../controllers/DateFormat";
import {usePages} from "../../../controllers/General";
import useRippleEffect from "../../../helpers/useRippleEffect";
import userStyles from "./styles/UserItem.module.css";

// eslint-disable-next-line react/prop-types
function UserItem({data, classes: givenClasses, skeleton, label}) {
    const history = useHistory();
    const onPointerDown = useRippleEffect();
    const pages = usePages();
    const classes = {...userStyles, ...(givenClasses || {})};
    const {value: userData, _date} = data || {};

    if (label) {
        return <ItemPlaceholderComponent classes={classes} label={label} pattern={"flat"}/>;
    }

    if (skeleton) {
        return <ItemPlaceholderComponent classes={classes} pattern={"flat"}/>;
    }

    const handleClick = () => {
        history.push(pages.user.route + userData.id);
    };

    const handleKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleClick();
    };

    return <div
        aria-label={userData.email}
        className={[classes.card, classes.cardFlat, classes.cardActionArea].join(" ")}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={onPointerDown}
        role='button'
        tabIndex={0}
    >
        <AvatarView
            className={[
                classes.avatar,
                userData.role === "userNotVerified" ? classes.notVerified : "",
                userData.role === "admin" ? classes.admin : "",
                userData.role === "disabled" ? classes.disabled : "",
            ].join(" ")}
            image={userData.image}
            initials={userData.initials}
            verified={true}
        />
        <div className={classes.cardContent}>
            <div className={classes.titleRow}>
                <UserName
                    id={userData.id}
                >
                    {userData.email}
                </UserName>
                <div className={classes.date}>
                    {toDateString(_date || userData.public.created)}
                </div>
            </div>
            <div className={classes.subheader}>
                {userData.name}<br/>
                {userData.public.address}
            </div>
        </div>
        {userData.public && <div className={classes.cardAction}>
            {userData.public.provider}
        </div>}
    </div>;
}

export default UserItem;
