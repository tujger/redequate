import React from "react";
import {Link} from "react-router-dom";
import {usePages} from "../../controllers/General";
import userNameStyles from "./UserName.module.css";

export default props => {
    const {children, className, id, onClick, ...rest} = props;
    const pages = usePages();

    return <Link
        {...rest}
        className={[userNameStyles.userName, className].filter(Boolean).join(" ")}
        onClick={event => {
            event.stopPropagation();
            onClick && onClick(event);
        }}
        to={pages.user.route + id}
    >
        {children}
    </Link>
}
