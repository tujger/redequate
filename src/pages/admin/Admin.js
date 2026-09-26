import React from "react";
import {useHistory} from "react-router-dom";
import {usePages} from "../../controllers/General";
import useRippleEffect from "../../helpers/useRippleEffect";
import adminStyles from "./styles/Admin.module.css";

const Admin = ({fetchMenu, classes = {}}) => {
    const history = useHistory();
    const pages = usePages();
    const itemsFlat = Object.keys(pages)
        .map(item => pages[item])
        .sort((o1, o2) => {
            if (o1.label > o2.label) return 1;
            if (o1.label < o2.label) return -1;
            return 0
        });

    const onPointerDown = useRippleEffect();

    const menu = fetchMenu(pages);

    return <div className={classes.center}>
        {itemsFlat.map((item, index) => {
            if (item.disabled) return null;
            if (item === pages.admin || !menu.filter(list => list[0] === pages.admin).filter(list => list.indexOf(item) >= 0).length) return null;
            const handleClick = () => {
                history.push(item.route);
            };

            const handleKeyDown = event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                handleClick();
            };

            return <div
                className={[adminStyles.card, adminStyles.cardActionArea].join(" ")}
                key={index}
                onPointerDown={onPointerDown}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                role='button'
                tabIndex={0}
            >
                {item.label}
            </div>
        })}
    </div>
};

export default Admin;
