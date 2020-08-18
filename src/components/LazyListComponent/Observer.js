import React from "react";
import {InView} from "react-intersection-observer";

export const Observer = ({finished, hasItems, loadNextPage, placeholder, placeholders}) => {
    if (finished) return null;
    return <React.Fragment>
        <InView
            onChange={(inView) => {
                if (inView) loadNextPage();
            }}
            ref={ref => {
                if (!ref) return;
                setTimeout(() => {
                    if (ref && ref.node) ref.node.style.display = "";
                }, hasItems ? 1500 : 0)
            }}
            style={{width: "100%", display: "none"}}
        />
        {(() => {
            const a = [];
            for (let i = 0; i < placeholders; i++) {
                a.push(i)
            }
            return a;
        })().map((item, index) => <placeholder.type {...placeholder.props} key={index}/>)}
    </React.Fragment>
}