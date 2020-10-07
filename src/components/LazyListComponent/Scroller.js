import React from "react";
import {useWindowData} from "../../controllers/General";
import {InView} from "react-intersection-observer";

// eslint-disable-next-line react/prop-types
export const Scroller = ({live, placeholder}) => {
    const windowData = useWindowData();
    const [scrolled, setScrolled] = React.useState(false);

    const scrollerShown = React.useRef();
    const taskRef = React.useRef();
    if (!live) return null;

    React.useEffect(() => {
        let isMounted = true;
        const handleScroll = (evt) => {
            if (!scrollerShown.current) {
                isMounted && setScrolled(true);
            }
        };
        window.addEventListener("touchmove", handleScroll, true)
        window.addEventListener("wheel", handleScroll, true)
        return () => {
            window.removeEventListener("touchmove", handleScroll);
            window.removeEventListener("wheel", handleScroll);
            isMounted = false;
        }
    }, [])

    return <InView
        onChange={(inView) => {
            scrollerShown.current = inView;
            if (inView) {
                setScrolled(false);
            }
        }}
        ref={ref => {
            clearTimeout(taskRef.current);
            if (ref && !scrolled) {
                taskRef.current = setTimeout(() => {
                    if (!ref.node) return;
                    if (ref.node.scrollIntoViewIfNeeded) ref.node.scrollIntoViewIfNeeded(false);
                    else ref.node.scrollIntoView({block: "end", inline: "nearest", behavior: "smooth"});
                }, 500);
            }
        }} style={{opacity: 0}}>
        {/*{windowData.isNarrow() ? placeholder : null}*/}
    </InView>
}
