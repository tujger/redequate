import React from "react";
import {withRouter} from "react-router-dom";
import Button from "@material-ui/core/Button";
import withStyles from "@material-ui/styles/withStyles";
import {connect, useDispatch} from "react-redux";
import Errors from "./Errors";
import {styles} from "../../controllers/Theme";
import {usePages, useWindowData} from "../../controllers/General";
import {auditReducer} from "../../reducers/auditReducer";
import {lazyListComponentReducer} from "../../components/LazyListComponent/lazyListComponentReducer";
import NavigationToolbar from "../../components/NavigationToolbar";

const Audit = (props) => {
    const dispatch = useDispatch();
    const pages = usePages();
    const windowData = useWindowData();
    const {classes, tabSelected, children = [(pages.errors && pages.errors.component) || <Errors/>]} = props;

    const handleChange = tabSelected => () => {
        dispatch({type: auditReducer.SAVE, tabSelected});
        dispatch({type: lazyListComponentReducer.RESET});
    }

    const selected = children[tabSelected] || children[0];

    return <>
        <NavigationToolbar
            alignItems={"flex-end"}
            justify={"center"}
            backButton={null}
            className={classes.topSticky}
            style={windowData.isNarrow() ? {padding: 0} : undefined}
        >
            {children.map((child, index) => {
                let label = "";
                for (const p in pages) {
                    if (pages[p].component && child && pages[p].component.type === child.type) {
                        label = pages[p].label;
                        break;
                    }
                }
                try {
                    label = label
                        || (child.type.WrappedComponent.Naked && child.type.WrappedComponent.Naked.name)
                        || (child.type.WrappedComponent && child.type.WrappedComponent.name);
                } catch (e) {
                    console.error(e);
                }
                return <Button
                    children={label}
                    className={[classes.tabButton, tabSelected === index ? classes.tabButtonSelected : ""].join(" ")}
                    color={"default"}
                    key={index}
                    onClick={handleChange(index)}
                    variant={"text"}
                />
            })}
        </NavigationToolbar>
        <selected.type {...props} {...selected.props}/>
    </>
};

const mapStateToProps = ({audit}) => ({
    tabSelected: audit.tabSelected,
});

export default connect(mapStateToProps)(withRouter(withStyles((theme) => ({
    ...styles(theme),
}))(Audit)));
