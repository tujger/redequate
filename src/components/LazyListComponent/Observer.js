import React from "react";
import {InView} from "react-intersection-observer";

// eslint-disable-next-line react/prop-types
export default ({active = true, finished, loadNextPage, placeholder, placeholders}) => {
    if (finished) return null;
    const [state = active, setState] = React.useState();

    return <>
        {state && <InView
            children={null}
            onChange={(inView) => {
                if (inView) {
                    loadNextPage();
                    setState(false);
                }
            }}
            style={{width: "100%"}}
        />}
        {(() => {
            const a = [];
            for (let i = 0; i < placeholders; i++) {
                a.push(i)
            }
            return a;
        })().map((item, index) => <placeholder.type {...placeholder.props} key={index}/>)}
    </>
}
