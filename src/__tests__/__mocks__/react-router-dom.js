// __mocks__/Card.js
'use strict';

import React from "react";

const Mock = props => component => {
    component.defaultProps = { ...component.defaultProps };
    return component;
};
// const Mock = props => component => {
//     component.defaultProps = { ...component.defaultProps };
//     return component;
// };

function __setMockFiles(newMockFiles) {
    console.log("CARDMEDIA")
}

Mock.__setMockFiles = __setMockFiles;
Mock.BrowserRouter = event => {
    const {children, ...rest} = event;
    console.log(children)

    return <children.type {...rest} {...children.type.props}/>
}

module.exports = Mock;
