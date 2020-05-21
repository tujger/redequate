import React from "react";
import PropTypes from "prop-types";

function LoadingComponent(props) {
    const {text = "Loading..."} = props;
    return <div className="progress-loading">
        {text}
        <svg className="progress-circular">
            <circle
                className="progress-path"
                cx="40"
                cy="40"
                fill="none"
                r="20"
                strokeWidth="2"
                strokeMiterlimit="10"
            />
        </svg>
    </div>;
}

LoadingComponent.propTypes = {
    text: PropTypes.string,
};

export default LoadingComponent;
