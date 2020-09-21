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
Mock.useDispatch = event => nest => {
    console.log({event: event, nest: nest})
};
Mock.Provider = event => {
    const {children, ...rest} = event;
    return <children.type {...rest} {...children.type.props}/>
};

module.exports = Mock;
