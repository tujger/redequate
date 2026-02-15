import type {Meta, StoryObj} from "@storybook/react";
import TopMenu from "../../../layouts/TopBottomMenuLayout/TopMenu";
import {Search as SearchIcon} from "@mui/icons-material";
import React from "react";

TopMenu.displayName = "TopMenu";

const meta: Meta<typeof TopMenu> = {
    component: TopMenu,
    tags: ["autodocs"],
    title: "layouts/TopBottomMenuLayout/TopMenu",
} satisfies Meta<typeof TopMenu>;

export default meta;

type Story = StoryObj<typeof TopMenu>;

export const Primary: Story = {
    args: {
        items: [[{
            route: "/iframe.html",
            label: "Page",
        },{
            label: "Page",
        },{
            route: "/iframe.html",
            label: "Page",
        }],[{
            label: "Page",
        },{
            route: "/iframe.html",
            label: "Page",
        },{
            route: "/iframe.html",
            label: "Page",
        }],[{
            label: "Page",
        },{
            route: "/iframe.html",
            label: "Page",
        },{
            route: "/iframe.html",
            label: "Page",
        }]]
    },
};
