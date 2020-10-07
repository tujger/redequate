import React from "react";
import {useHistory} from "react-router-dom";

const Home = (props) => {
    const history = useHistory();

    React.useEffect(() => {
        history.entries = [];
        history.index = -1;
        history.push(window.location.pathname);
        // eslint-disable-next-line
    }, []);

    return <>
        {props.children}
    </>
};

export default Home;
