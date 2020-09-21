// __mocks__/Card.js
'use strict';

import React from "react";
import auth from "./auth";
import database from "./database";

const Mock = props => component => {
    component.defaultProps = { ...component.defaultProps };
    return component;
};

function __setMockFiles(newMockFiles) {
    console.log("CARDMEDIA")
}

Mock.__setMockFiles = __setMockFiles;
Mock.auth = auth
Mock.database = database

module.exports = Mock;
