// __mocks__/Card.js
'use strict';

import React from "react";

const Mock = Object.create(null);//jest.createMockFromModule('notistack');

function __setMockFiles(newMockFiles) {
    console.log("CARD")
}

Mock.__setMockFiles = __setMockFiles;
Mock.connect = style => component => {
    // const classes = typeof style === 'function' ? style() : style;
    component.defaultProps = { ...component.defaultProps };
    return component;
};
Mock.useDispatch = value => {

};

module.exports = Mock;
