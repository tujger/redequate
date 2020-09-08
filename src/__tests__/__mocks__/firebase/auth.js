// __mocks__/Card.js
'use strict';

import React from "react";

const Mock = props => ({
    signOut: () => {}
});

function __setMockFiles(newMockFiles) {
    console.log("CARDMEDIA")
}

Mock.__setMockFiles = __setMockFiles;

module.exports = Mock;
