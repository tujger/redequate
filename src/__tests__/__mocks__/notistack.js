// __mocks__/notistack.js
'use strict';

import React from "react";

const notistack = Object.create(null);//jest.createMockFromModule('notistack');

function __setMockFiles(newMockFiles) {
    console.log("NOTISTACK")
}

notistack.__setMockFiles = __setMockFiles;

module.exports = notistack;
