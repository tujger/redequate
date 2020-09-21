// __mocks__/Card.js
'use strict';

import React from "react";

const Mock2 = event => {
    const {children, ...rest} = event;
    console.log("2",event)

    return <>{children}</>
}

const Mock = event => {
    const {children, ...rest} = event;
    console.log("1", event)

    return Mock2;
}

function __setMockFiles(newMockFiles) {
    console.log("THEMEPROVIDER")
}

Mock.__setMockFiles = __setMockFiles;

module.exports = Mock;
