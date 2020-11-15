import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import ProgressView from "../../components/ProgressView";

const styles = theme => ({
    sticky: {
        display: "flex",
        flexBasis: theme.mixins.toolbar.minHeight,
        flexGrow: 0,
        flexShrink: 0,
        justifyContent: "flex-end",
        // height: theme.mixins.toolbar.minHeight,
        position: "sticky",
        top: 0,
        zIndex: 2
    },
    stickycollapsed: {
        // backgroundImage: "url("+header +")",
        backgroundRepeat: "no-repeat",
        backgroundPositionY: "bottom",
    },
    title: {
        fontSize: "2.5rem",
        left: theme.spacing(1),
        position: "fixed",
        top: theme.spacing(1),
        transition: "150ms",
        zIndex: 3,
        ...theme.fetchOverride(theme => theme.customized.topBottomLayout.title),
    },
    titlecollapsed: {
        alignItems: "center",
        display: "flex",
        fontSize: "1.875rem",
        height: theme.mixins.toolbar.minHeight,
        top: 0,
    },
    content: {
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        flexBasis: theme.spacing(16),
        flexGrow: 0,
        flexShrink: 0,
        // height: theme.spacing(16),
        zIndex: 2,
    },
    observer: {
        height: 0,
        marginTop: -theme.mixins.toolbar.minHeight
    }
});

export const StickyHeaderComponent = withStyles(styles)(({classes, content, image, menuComponent, title, titleClassName}) => {
    const [state, setState] = React.useState({collapsed: false});
    const {collapsed} = state;
    const refObserver = React.createRef();

    React.useEffect(() => {
        const observer = new window.IntersectionObserver((entries) => {
            entries.map(entry => {
                setState(state => ({...state, collapsed: !entry.isIntersecting}));
                return null;
            })
        }, {
            threshold: new Array(101).fill(0).map((v, i) => i * 0.01),
        });
        observer.observe(refObserver.current);
        return () => {
            observer.disconnect();
        }
        // eslint-disable-next-line
    }, []);

    return <>
        <div
            className={[classes.title, collapsed ? classes.titlecollapsed : null, titleClassName].join(" ")}>{title}</div>
        <div className={classes.content} style={{backgroundImage: `url(${image})`}}>{content}</div>
        <div ref={refObserver} className={classes.observer}/>
        <div
            className={[classes.sticky, collapsed ? classes.stickycollapsed : null].join(" ")}
            style={collapsed ? {backgroundImage: `url(${image})`} : null}
        >
            {menuComponent}
            <ProgressView/>
        </div>
    </>
})
