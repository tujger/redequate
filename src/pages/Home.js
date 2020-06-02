import React from "react";
import {withRouter} from "react-router-dom";

const Home = (props) => {
    const {history} = props;
    React.useEffect(() => {
        history.entries = [];
        history.index = -1;
        history.push(window.location.pathname);
// eslint-disable-next-line
    }, []);

    return <React.Fragment>
        {props.children}
    </React.Fragment>
};

export default withRouter(Home);
