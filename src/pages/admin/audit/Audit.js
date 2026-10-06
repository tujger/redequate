import React from "react";
import {connect, useDispatch} from "react-redux";
import {withRouter} from "react-router-dom";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import NavigationToolbar from "../../../components/NavigationToolbar";
import {usePages} from "../../../controllers/General";
import Tabs from "../../../controls/Tabs/Tabs";
import Activity from "./Activity";
import {auditReducer} from "./auditReducer";
import Errors from "./Errors";

// eslint-disable-next-line react/prop-types
const Audit = props => {
    const dispatch = useDispatch();
    const pages = usePages();
    const {
        children = [
            <Errors/>,
            <Activity/>
        ],
        classes: givenClasses,
        tabSelected,
    } = props;
    const classes = givenClasses || {};

    const handleChange = tabSelected => {
        dispatch({type: auditReducer.SAVE, tabSelected});
        dispatch({type: lazyListComponentReducer.RESET});
    }

    const selected = children[tabSelected] || children[0];
    const items = children.map((child, index) => {
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
        return {label, value: index};
    });

    return <>
        <NavigationToolbar
            alignItems={"flex-end"}
            justify={"center"}
            backButton={null}
        >
            <Tabs
                items={items}
                onChange={handleChange}
                value={tabSelected}
            />
        </NavigationToolbar>
        <selected.type {...props} {...selected.props} classes={classes}/>
    </>
};

const mapStateToProps = ({audit}) => ({
    tabSelected: audit.tabSelected,
});

export default connect(mapStateToProps)(withRouter(Audit));
