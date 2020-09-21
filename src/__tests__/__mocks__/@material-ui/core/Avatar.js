// __mocks__/Card.js
'use strict';

import React from "react";

const Mock = Object.create(null);//jest.createMockFromModule('notistack');

function __setMockFiles(newMockFiles) {
    console.log("AVATAR")
}

Mock.__setMockFiles = __setMockFiles;

module.exports = Mock;
