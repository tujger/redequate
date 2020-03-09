import React from "react";
import {List} from "@material-ui/core";
import PropTypes from 'prop-types';
import ListItemComponent from "./ListItemComponent";

const ListComponent = props => {
    let {
        items,
        emptyComponent,
        itemComponent
    } = props;

    /*const [state, setState] = React.useState({sortType: "createDate", sortReverse: false});

    items = items.sort((first, second) => {
        if (["fromDate", "toDate", "createDate"].indexOf(state.sortType) >= 0) {
            const left = first[state.sortType];
            const right = second[state.sortType];
            return (left > right ? -1 : left < right ? 1 : 0) * (state.sortReverse ? -1 : 1);
        } else {
            const left = first[state.sortType] || "";
            const right = second[state.sortType] || "";
            return left.toLowerCase().localeCompare(right.toLowerCase()) * (state.sortReverse ? -1 : 1);
        }
    });*/

    return <List>
        {items.map((item, index) => <ListItemComponent key={index}>
            <itemComponent.type {...itemComponent.props} data={item} onSwipe={action => {
                console.log(item);
                if(action === "right") return true;
                throw Error("Unimplemented yet: " + action);
            }}/>
        </ListItemComponent>)}
        {!items.length && emptyComponent}
    </List>
};

ListComponent.propTypes = {
    items: PropTypes.array,
    itemComponent: PropTypes.any,
    emptyComponent: PropTypes.any,
};

export default ListComponent;
