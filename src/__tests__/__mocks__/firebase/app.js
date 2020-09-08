// __mocks__/Card.js
'use strict';

import React from "react";

const Mock = props => component => {
    component.defaultProps = { ...component.defaultProps };
    return component;
};

function __setMockFiles(newMockFiles) {
    console.log("CARDMEDIA")
}

Mock.__setMockFiles = __setMockFiles;
Mock.auth = () => ({
    getRedirectResult: async () => {},
    signOut: async () => {},
    sendSignInLinkToEmail: async () => {}
})

module.exports = Mock;
