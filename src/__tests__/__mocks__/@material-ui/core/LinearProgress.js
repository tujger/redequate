// __mocks__/Card.js
'use strict';

import React from "react";

const Mock = () => () => {
    console.log("AAAAAAAAAAAAA")
    return <div>AAAAAAAAAAAAA</div>
}

function __setMockFiles(newMockFiles) {
    console.log("LINEARPROGRESS")
}

Mock.__setMockFiles = __setMockFiles;

module.exports = Mock;
