import React from "react";

function LoadingComponent({text = "Loading..."}) {
    return <div className={"progress-loading"}>
        {text}
        <svg className={"progress-circular"}>
            <circle
                className={"progress-path"}
                cx={"40"}
                cy={"40"}
                fill={"none"}
                r={"20"}
                strokeWidth={"2"}
                strokeMiterlimit={"10"}
            />
        </svg>
    </div>;
}

export default LoadingComponent;
