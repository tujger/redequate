import type {Meta, StoryObj} from "@storybook/react";
import React from "react";
import InfoComponent from "../../components/InfoComponent";

InfoComponent.displayName = "InfoComponent";

const meta: Meta<typeof InfoComponent> = {
    component: InfoComponent,
    tags: ["autodocs"],
    title: "components/InfoComponent",
} satisfies Meta<typeof InfoComponent>;

export default meta;

type Story = StoryObj<typeof InfoComponent>;

export const Primary: Story = {
    args: {
        children: "internal text",
        prefix: undefined,
        suffix: undefined,
        variant: "caption",
        className: "",
        style: {}
    },
};
