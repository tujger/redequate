import type {Meta, StoryObj} from "@storybook/react";
import React from "react";
import HeaderComponent from "../../components/HeaderComponent";

HeaderComponent.displayName = "HeaderComponent";

const meta: Meta<typeof HeaderComponent> = {
    component: HeaderComponent,
    tags: ["autodocs"],
    title: "components/HeaderComponent",
} satisfies Meta<typeof HeaderComponent>;

export default meta;

type Story = StoryObj<typeof HeaderComponent>;

export const Primary: Story = {
    args: {
        menuComponent: undefined,
        title: "Title",
        narrow: false,
        image: "",
        narrowComponent: undefined,
        wide: false,
        wideComponent: undefined
    },
};
