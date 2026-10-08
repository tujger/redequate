import React from "react";
import {Link} from "react-router-dom";
import {usePages} from "../../controllers/General";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/MainHeader.module.css";

export default props => {
    const {title, image} = props;
    const pages = usePages();
    const onPointerDown = useRippleEffect();

    return <div
        className={styles.header}
        style={image ? {
            backgroundImage: `url(${image})`
        } : null}>
        <div className={styles.name}>
            <Link to={pages.home.route} className={styles.label} onPointerDown={onPointerDown}>
                {title}
            </Link>
        </div>
    </div>
};
