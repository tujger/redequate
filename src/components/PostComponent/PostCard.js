import React from "react";
import PostCardLayoutNarrow from "./PostCardLayoutNarrow";
import PostCardLayoutWide from "./PostCardLayoutWide";
import ReplyCardLayoutNarrow from "./ReplyCardLayoutNarrow";
import {useWindowData} from "../../controllers/General";

export default (props) => {
    const {level, postData, highlight} = props;
    const windowData = useWindowData();
    const isNarrow = windowData && windowData.isNarrow
        ? windowData.isNarrow()
        : typeof window !== "undefined" && window.innerWidth < 600;

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

    return isNarrow
        ? (level > 0
            ? <ReplyCardLayoutNarrow {...inheritProps}/>
            : <PostCardLayoutNarrow {...inheritProps}/>)
        : <PostCardLayoutWide {...inheritProps}/>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
