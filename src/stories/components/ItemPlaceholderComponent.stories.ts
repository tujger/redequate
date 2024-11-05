import type {Meta, StoryObj} from "@storybook/react";
import React from "react";
import ItemPlaceholderComponent from "../../components/ItemPlaceholderComponent";

ItemPlaceholderComponent.displayName = "ItemPlaceholderComponent";

const meta: Meta<typeof ItemPlaceholderComponent> = {
    component: ItemPlaceholderComponent,
    tags: ["autodocs"],
    title: "components/ItemPlaceholderComponent",
} satisfies Meta<typeof ItemPlaceholderComponent>;

export default meta;

type Story = StoryObj<typeof ItemPlaceholderComponent>;

export const Primary: Story = {
    args: {
        avatar: undefined,
        classes: {},
        className: "",
        label: "Item Placeholder",
        onClick: undefined,
        pattern: "pattern"
    },
};
