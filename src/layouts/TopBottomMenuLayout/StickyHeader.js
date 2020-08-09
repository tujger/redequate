import React from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/styles/withStyles";
import ProgressView from "../../components/ProgressView";
import {StickyHeaderComponent} from "./StickyHeaderComponent";

const styles = theme => ({
    container: {
        position: "relative",
    },
    stickyBottom: {
        position: "sticky",
        bottom: 0
    },
});

const StickyHeader = props => {
    const {classes, className, children, headerComponent = <StickyHeaderComponent/>, headerImage, menuComponent, stickyBottom, stickyBottomClassName, title, titleClassName, content} = props;

    return <div className={[classes.container, className].join(" ")}>
        <headerComponent.type {...headerComponent.props} headerImage={headerImage} content={content} menuComponent={menuComponent} title={title} titleClassName={titleClassName}/>
        <ProgressView/>
        {children}
        <div className={[classes.stickyBottom, stickyBottomClassName].join(" ")}>{stickyBottom}</div>
    </div>
};

StickyHeader.propTypes = {
    children: PropTypes.any,
    headerImage: PropTypes.string,
};

export default withStyles(styles)(StickyHeader);

