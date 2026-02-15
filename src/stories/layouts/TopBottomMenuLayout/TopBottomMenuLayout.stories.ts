import type {Meta, StoryObj} from "@storybook/react";
import TopBottomMenuLayout from "../../../layouts/TopBottomMenuLayout/TopBottomMenuLayout";
import {Search as SearchIcon} from "@mui/icons-material";
import React from "react";

TopBottomMenuLayout.displayName = "TopBottomMenuLayout";

const meta: Meta<typeof TopBottomMenuLayout> = {
    component: TopBottomMenuLayout,
    tags: ["autodocs"],
    title: "layouts/TopBottomMenuLayout/TopBottomMenuLayout",
} satisfies Meta<typeof TopBottomMenuLayout>;

export default meta;

type Story = StoryObj<typeof TopBottomMenuLayout>;

export const Primary: Story = {
    args: {
        menu: [[/*{
            route: "/iframe.html",
            label: "Page",
        }, {
            label: "Page",
        }, {
            route: "/iframe.html",
            label: "Page",
        }], [{
            label: "Page",
        }, {
            route: "/iframe.html",
            label: "Page",
        }, {
            route: "/iframe.html",
            label: "Page",
        }], [{
            label: "Page",
        }, {
            route: "/iframe.html",
            label: "Page",
        }, {
            route: "/iframe.html",
            label: "Page",
        }*/]],
    },
};
