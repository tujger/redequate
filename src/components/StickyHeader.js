import React from "react";
import PropTypes from "prop-types";
import {withStyles} from "@material-ui/core";

const styles = theme => ({
    container: {
        position: "relative",
    },
    sticky: {
        display: "flex",
        height: theme.mixins.toolbar.minHeight,
        position: "sticky",
        top: 0,
        zIndex: 1
    },
    stickycollapsed: {
        // backgroundImage: "url("+header +")",
        backgroundRepeat: "no-repeat",
        backgroundPositionY: "bottom",
    },
    stickyBottom: {
        position: "sticky",
        bottom: 0
    },
    title: {
        fontSize: "2.5rem",
        left: theme.spacing(1),
        position: "fixed",
        top: theme.spacing(1),
        transition: "150ms",
        zIndex: 2,
    },
    titlecollapsed: {
        alignItems: "center",
        display: "flex",
        fontSize: "1.875rem",
        height: theme.mixins.toolbar.minHeight,
        top: 0,
    },
    content: {
        // backgroundImage: "url("+header +")",
        backgroundRepeat: "no-repeat",
        height: 128,
        // height: 128 - 52,
        zIndex: 2,
    },
    observer: {
        height: 0,
    }
});

const StickyHeader = props => {
    const {classes, className, children, headerImage, sticky, stickyClassName, stickyBottom, stickyBottomClassName, title, titleClassName, content} = props;
    const [state, setState] = React.useState({collapsed: false});
    const {collapsed} = state;

    const refObserver = React.createRef();
    const refSticky = React.createRef();
    const observer = new IntersectionObserver((entries) => {
        entries.map(entry => {
            setState({...state, collapsed: !entry.isIntersecting});
            return null;
        })
    }, {
        threshold: new Array(101).fill(0).map((v, i) => i * 0.01),
    });

    React.useEffect(() => {
        const rectSticky = refSticky.current.getBoundingClientRect();
        refObserver.current.style.marginTop = `-${rectSticky.height}px`;
        observer.observe(refObserver.current);
        return () => {
            observer.disconnect();
        }
        // eslint-disable-next-line
    }, []);

    return <div className={[classes.container, className].join(" ")}>
        <div
            className={[classes.title, collapsed ? classes.titlecollapsed : null, titleClassName].join(" ")}>{title}</div>
        <div className={classes.content}
             style={{backgroundImage: `url(${headerImage})`}}>{content}</div>
        <div ref={refObserver} className={classes.observer}/>
        <div ref={refSticky}
             className={[classes.sticky, collapsed ? classes.stickycollapsed : null, stickyClassName].join(" ")}
             style={collapsed ? {backgroundImage: `url(${headerImage})`} : null}
        >{sticky}</div>
        {children}
        <div
            className={[classes.stickyBottom, stickyBottomClassName].join(" ")}>{stickyBottom}</div>
    </div>
};

StickyHeader.propTypes = {
    children: PropTypes.any,
    headerImage: PropTypes.string,
};

export default withStyles(styles)(StickyHeader);
