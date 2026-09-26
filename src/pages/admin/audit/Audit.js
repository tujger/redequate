import React from "react";
import {connect, useDispatch} from "react-redux";
import {withRouter} from "react-router-dom";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import NavigationToolbar from "../../../components/NavigationToolbar";
import {usePages, useWindowData} from "../../../controllers/General";
import useRippleEffect from "../../../helpers/useRippleEffect";
import Activity from "./Activity";
import {auditReducer} from "./auditReducer";
import Errors from "./Errors";
import baseStyles from "../../../themes/Base.module.css";
import auditStyles from "./styles/Audit.module.css";

// eslint-disable-next-line react/prop-types
const Audit = props => {
    const dispatch = useDispatch();
    const pages = usePages();
    const windowData = useWindowData();
    const onPointerDown = useRippleEffect();
    const {
        children = [
            <Errors/>,
            <Activity/>
        ],
        classes: givenClasses,
        tabSelected,
    } = props;
    const classes = {...baseStyles, ...auditStyles, ...(givenClasses || {})};

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
                return <button
                    className={[classes.tabButton, tabSelected === index ? classes.tabButtonSelected : "", baseStyles.ripple].join(" ")}
                    key={index}
                    onClick={handleChange(index)}
                    onPointerDown={onPointerDown}
                    type='button'
                >
                    {label}
                </button>
            })}
        </NavigationToolbar>
        <selected.type {...props} {...selected.props} classes={classes}/>
    </>
};

const mapStateToProps = ({audit}) => ({
    tabSelected: audit.tabSelected,
});

export default connect(mapStateToProps)(withRouter(Audit));
