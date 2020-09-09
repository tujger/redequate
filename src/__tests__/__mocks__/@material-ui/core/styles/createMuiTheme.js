// __mocks__/Card.js
'use strict';

import React from "react";

const Mock = style => component => {
    // const classes = typeof style === 'function' ? style() : style;
    component.defaultProps = { ...component.defaultProps };
    return component;
};

function __setMockFiles(newMockFiles) {
    console.log("CARDMEDIA")
}

Mock.__setMockFiles = __setMockFiles;
Mock.default = event => event => event;

module.exports = Mock;
