import React from "react";
import ThemeAbstract from "../../themes/ThemeAbstract";
import {render, unmount} from "../render";

describe("ThemeAbstract without stylesheet input", () => {
    it("does not inject placeholder styles and preserves existing head nodes", () => {
        const container = document.createElement("div");
        const previous = [...document.head.children];
        try {
            render(<ThemeAbstract/>, container);
            expect([...document.head.children]).toEqual(previous);
        } finally {
            unmount(container);
        }
        expect([...document.head.children]).toEqual(previous);
    });
});
