import React from "react";
import {withRouter} from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import withStyles from "@material-ui/styles/withStyles";
import {connect, useDispatch} from "react-redux";
import Errors from "./Errors";
import {styles} from "../../controllers/Theme";
import {usePages} from "../../controllers/General";
import {auditReducer} from "../../reducers/auditReducer";
import {lazyListComponentReducer} from "../../components/LazyListComponent/lazyListComponentReducer";

const Audit = (props) => {
    const {tabSelected, children = [<Errors/>]} = props;
    const dispatch = useDispatch();
    const pages = usePages();

    const handleChange = (event, tabSelected) => {
        dispatch({type: auditReducer.SAVE, tabSelected});
        dispatch({type: lazyListComponentReducer.RESET});
    }

    const selected = children[tabSelected] || children[0];

    return <>
        <Tabs
            // scrollButtons={"on"}
            centered
            indicatorColor={"secondary"}
            onChange={handleChange}
            value={tabSelected}
            // variant={"scrollable"}
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
                    label = label || child.type.WrappedComponent.name;
                } catch (e) {
                    console.error(e);
                }
                return <Tab key={index} label={label}/>
            })}
        </Tabs>
        <Grid container alignItems={"flex-start"}>
            <selected.type {...props} {...selected.props}/>
        </Grid>
    </>
};

const mapStateToProps = ({audit}) => ({
    tabSelected: audit.tabSelected,
});

export default connect(mapStateToProps)(withRouter(withStyles((theme) => ({
    ...styles(theme),
}))(Audit)));
