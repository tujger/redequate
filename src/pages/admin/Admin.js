import React from "react";
import {useHistory} from "react-router-dom";
import CardActionArea from "@material-ui/core/CardActionArea";
import Card from "@material-ui/core/Card";
import withStyles from "@material-ui/styles/withStyles";
import {CardHeader} from "@material-ui/core";
import {usePages} from "../../controllers/General";
import {stylesList} from "../../controllers/Theme";

const Admin = ({menu:menuFunc, classes}) => {
    const history = useHistory();
    const menu = menuFunc();
    const pages = usePages();
    const itemsFlat = Object.keys(pages)
        .map(item => pages[item])
        .sort((o1, o2) => {
            if (o1.label > o2.label) return 1;
            if (o1.label < o2.label) return -1;
            return 0
        });

    return <>
        {itemsFlat.map((item, index) => {
            if(item.disabled) return null;
            if (item === pages.admin || !menu.filter(list => list[0] === pages.admin).filter(list => list.indexOf(item) >= 0).length) return null;
            return <Card key={index} className={[classes.root, classes.card].join(" ")}>
                <CardActionArea onClick={() => {
                    history.push(item.route);
                }}>
                    <CardHeader subheader={item.label}/>
                </CardActionArea>
            </Card>
        })}
    </>
};

export default withStyles(stylesList)(Admin);
