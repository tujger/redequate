import React from "react";
import Hidden from "@material-ui/core/Hidden";
import PostCardLayoutNarrow from "./PostCardLayoutNarrow";
import PostCardLayoutWide from "./PostCardLayoutWide";
import ReplyCardLayoutNarrow from "./ReplyCardLayoutNarrow";

export default (props) => {
    const {level, postData, highlight} = props;

    const ref = React.useRef();
    const [state, setState] = React.useState({});
    const {highlighted} = state;

    React.useEffect(() => {
        if (!highlight) return;
        let isMounted = true;
        if (postData.id === highlight) {
            isMounted && setState(state => ({...state, highlighted: true}));
            setTimeout(() => {
                isMounted && setState(state => ({...state, highlighted: false}));
            }, 1000);
        }
        return () => {
            isMounted = false;
        }
    }, [highlight]);

    React.useEffect(() => {
        if (!highlight) return;
        if (ref.current) {
            // console.log("SCROLLINTO", ref.current);
            ref.current.scrollIntoViewIfNeeded();
        }
    }, [ref.current]);

    const inheritProps = {
        ...props,
        highlight,
        highlighted,
        ref,
    }

    return <>
        <Hidden mdUp>
            {level > 0
                ? <ReplyCardLayoutNarrow {...inheritProps}/>
                : <PostCardLayoutNarrow {...inheritProps}/>}
        </Hidden>
        <Hidden smDown>
            <PostCardLayoutWide {...inheritProps}/>
        </Hidden>
    </>
}
