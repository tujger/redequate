import React, {Suspense} from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/styles/withStyles";
import {Route, Switch} from "react-router-dom";
import {matchRole, needAuth} from "../controllers/User";
import LoadingComponent from "../components/LoadingComponent";

const styles = theme => ({
    content: {
        display: "flex",
        flex: "1 1 auto",
        flexDirection: "column",
        maxWidth: "100%",
        padding: theme.spacing(1),
        position: "relative",
        overflow: "auto"
    },
});

const MainContent = props => {
    const {pages, classes, user} = props;
    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    return <main className={classes.content}>
        <Suspense fallback={<LoadingComponent/>}>
            <Switch>{itemsFlat.map((item, index) => <Route
                key={index}
                path={item.route}
                exact={true}
                children={
                    needAuth(item.roles, user)
                        ? <pages.login.component.type {...props} {...pages.login.component.props}/>
                        : (matchRole(item.roles, user)
                        ? <item.component.type {...props} {...item.component.props}/>
                        : <pages.notfound.component.type {...props} {...pages.notfound.component.props}/>)}
            />)}</Switch>
        </Suspense>
    </main>
};

MainContent.propTypes = {
    pages: PropTypes.object,
    user: PropTypes.any,
};

export default withStyles(styles)(MainContent);
