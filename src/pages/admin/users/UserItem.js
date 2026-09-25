import React from "react";
import {useHistory} from "react-router-dom";
import {usePages} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import {toDateString} from "../../../controllers/DateFormat";
import userStyles from "./styles/UserItem.module.css";

// eslint-disable-next-line react/prop-types
function UserItem({data, classes: givenClasses, skeleton, label}) {
    const history = useHistory();
    const pages = usePages();
    const classes = {...userStyles, ...(givenClasses || {})};
    const rippleId = React.useRef(0);
    const [ripples, setRipples] = React.useState([]);
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

    const createRipple = event => {
        const target = event.currentTarget;
        const bounds = target.getBoundingClientRect();
        const x = event.clientX === undefined ? bounds.width / 2 : event.clientX - bounds.left;
        const y = event.clientY === undefined ? bounds.height / 2 : event.clientY - bounds.top;
        const size = Math.max(bounds.width, bounds.height) * 2;
        const id = rippleId.current++;

        setRipples(current => [...current, {id, x, y, size}]);
    };

    const handleKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        createRipple(event);
        handleClick();
    };

    return <div
        aria-label={userData.email}
        className={[classes.card, classes.cardFlat, classes.cardActionArea].join(" ")}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={createRipple}
        role="button"
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
        <span className={classes.rippleContainer} aria-hidden="true">
            {ripples.map(ripple => <span
                className={classes.ripple}
                key={ripple.id}
                onAnimationEnd={() => setRipples(current => current.filter(item => item.id !== ripple.id))}
                style={{
                    "--ripple-size": `${ripple.size}px`,
                    "--ripple-x": `${ripple.x}px`,
                    "--ripple-y": `${ripple.y}px`,
                }}
            />)}
        </span>
    </div>;
}

export default UserItem;
