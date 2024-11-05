import type {Meta, StoryObj} from "@storybook/react";
import {ProgressView} from "../../components/ProgressView";

ProgressView.displayName = "ProgressView";

const meta: Meta<typeof ProgressView> = {
    component: ProgressView,
    tags: ["autodocs"],
    title: "components/ProgressView",
} satisfies Meta<typeof ProgressView>;

export default meta;

type Story = StoryObj<typeof ProgressView>;

export const Indeterminate: Story = {
    args: {
        show: true,
    },
};

export const Determinate: Story = {
    args: {
        show: true,
        value: 33,
    },
};
