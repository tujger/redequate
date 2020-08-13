import React from "react";
import {unmountComponentAtNode} from "react-dom";
import firebaseConfig from "../../../gamepal-dev/src/firebase-config.json";
import Firebase from "../controllers/Firebase";
import Store from "../controllers/Store";

export const firebase = Firebase(firebaseConfig);
export const store = Store("EdeqaTests");

export let container = null;
beforeAll(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
});

afterAll(() => {
    unmountComponentAtNode(container);
    container.remove();
    container = null;
});
