import React from "react";
import {useHistory} from "react-router-dom";
import {usePages} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import {toDateString} from "../../../controllers/DateFormat";
import baseStyles from "../../../themes/Base.module.css";
import userStyles from "./styles/UserItem.module.css";

// eslint-disable-next-line react/prop-types
function UserItem({data, classes: givenClasses, skeleton, label}) {
    const history = useHistory();
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
        className={[classes.card, classes.cardFlat, classes.cardActionArea, baseStyles.ripple].join(" ")}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
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
                <div className={classes.userName}>
                    {userData.email}
                </div>
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
