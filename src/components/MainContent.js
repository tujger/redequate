import React, {Suspense} from "react";
import PropTypes from "prop-types";
import {withStyles} from "@material-ui/core";
import {Switch} from "react-router-dom";
import {matchRole, needAuth} from "../controllers/User";
import LoadingComponent from "../components/LoadingComponent";
import Route from "react-router-hooks";

const styles = theme => ({
    content: {
        display: "flex",
        flex: "1 1 auto",
        flexDirection: "column",
        maxWidth: "100%",
        padding: theme.spacing(1),
        overflow: "auto"
    },
});

const MainContent = props => {
    const {pages, classes, user} = props;
    const itemsFlat = Object.keys(pages).map(item => pages[item]);
    console.log(user.currentUser())
    return <main className={classes.content}>
        <Suspense fallback={<LoadingComponent/>}>
            <Switch>
                {itemsFlat.map((item, index) => <Route
                    key={index}
                    path={item.route}
                    exact={true}
                    children={needAuth(item.roles, user.currentUser())
                        ?
                        <pages.login.component.type {...props} {...pages.login.component.props}/> : (matchRole(item.roles, user.currentUser())
                            ? <item.component.type {...props} {...item.component.props}/> :
                            <pages.notfound.component.type {...props} {...pages.notfound.component.props}/>)}
                    onEnter={() => {
                        document.title = needAuth(item.roles, user.currentUser())
                            ? pages.login.title || pages.login.label : (matchRole(item.roles, user.currentUser())
                                ? item.title || item.label : pages.notfound.title || pages.notfound.label);
                        // dispatch(ProgressView.HIDE);
                    }}/>
                )}
            </Switch>
        </Suspense>
    </main>
};

MainContent.propTypes = {
    pages: PropTypes.object,
    user: PropTypes.any,
};

export default withStyles(styles)(MainContent);
