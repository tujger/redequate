import React, {Suspense} from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/styles/withStyles";
import {Route, Switch, useHistory} from "react-router-dom";
import {matchRole, needAuth, useUser} from "../controllers/User";
import LoadingComponent from "../components/LoadingComponent";
import {usePages} from "../controllers/General";
import Modal from "./ModalComponent";

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
    const {classes} = props;
    const pages = usePages();
    const user = useUser();
    const history = useHistory();
    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    let background = history.location.state && history.location.state.background;

    return <main className={[classes.content].join(" ")}>
        <Suspense fallback={<LoadingComponent/>}>
            <Switch>{itemsFlat.map((item, index) => {
                return <Route
                    key={index}
                    path={item.route}
                    exact={true}
                    render={() => {
                        return needAuth(item.roles, user)
                            ? <pages.login.component.type {...props} {...pages.login.component.props} />
                            : (matchRole(item.roles, user)
                            ? <item.component.type {...props} classes={{}} {...item.component.props} />
                            : <pages.notfound.component.type {...props} {...pages.notfound.component.props} />)
                        }
                    }
                />
            })}</Switch>
        </Suspense>
            <Modal/>
    </main>
};

MainContent.propTypes = {
    pages: PropTypes.object,
    user: PropTypes.any,
};

export default withStyles(styles)(MainContent);


const ModalWindow = () => {
    let history = useHistory();

    let back = e => {
        e.stopPropagation();
        history.goBack();
    };

    return (
        <div
            onClick={back}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                background: "rgba(0, 0, 0, 0.15)"
            }}
        >
            <div
                className="modal"
                style={{
                    position: "absolute",
                    background: "#fff",
                    top: 25,
                    left: "10%",
                    right: "10%",
                    padding: 15,
                    border: "2px solid #444"
                }}
            >
                <h1>TITLE</h1>
                <button type="button" onClick={back}>
                    Close
                </button>
            </div>
        </div>
    );
}
