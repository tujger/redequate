import React from "react";
import {InView} from "react-intersection-observer";

export default ({active = true, finished, loadNextPage, placeholder, placeholders = 1}) => {
    if (finished) return null;
    return <InView
        skip={!active}
        triggerOnce
        onChange={inView => {
            if (inView) loadNextPage();
        }}
        style={{width: "100%"}}
    >
        {Array.from({length: placeholders}, (_, index) => React.cloneElement(placeholder, {key: index}))}
    </InView>;
};
