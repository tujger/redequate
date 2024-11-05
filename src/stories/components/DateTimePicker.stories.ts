import type {Meta, StoryObj} from "@storybook/react";
import React from "react";
import DateTimePicker from "../../components/DateTimePicker";

DateTimePicker.displayName = "DateTimePicker";

const meta: Meta<typeof DateTimePicker> = {
    component: DateTimePicker,
    tags: ["autodocs"],
    title: "components/DateTimePicker",
} satisfies Meta<typeof DateTimePicker>;

export default meta;

type Story = StoryObj<typeof DateTimePicker>;

export const Primary: Story = {
    args: {
        inline: false,
        range: false,
        onChange: event => console.log(event)
    },
};
