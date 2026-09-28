import React from "react";
import {useHistory} from "react-router-dom";
import {usePages} from "../../controllers/General";
import Button from "../../controls/Button/Button";
import adminStyles from "./styles/Admin.module.css";
import baseStyles from "../../themes/Base.module.css";

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

    const menu = fetchMenu(pages);

    return <div className={baseStyles.content}>
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

            return <Button
                className={[adminStyles.button].join(" ")}
                key={index}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                title={item.label}
            >
                {item.label}
            </Button>
        })}
    </div>
};

export default Admin;
