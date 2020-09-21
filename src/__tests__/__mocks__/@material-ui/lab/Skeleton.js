// __mocks__/Card.js
'use strict';

import React from "react";

const Mock = Object.create(null);//jest.createMockFromModule('notistack');

function __setMockFiles(newMockFiles) {
    console.log("SKELETON")
}

Mock.__setMockFiles = __setMockFiles;

module.exports = Mock;
