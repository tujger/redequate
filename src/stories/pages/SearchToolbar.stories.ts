import type {Meta, StoryObj} from "@storybook/react";
import SearchToolbar from "../../pages/search/SearchToolbar";

SearchToolbar.displayName = "SearchToolbar";

const meta: Meta<typeof SearchToolbar> = {
    component: SearchToolbar,
    tags: ["autodocs"],
    title: "pages/SearchToolbar",
} satisfies Meta<typeof SearchToolbar>;

export default meta;

type Story = StoryObj<typeof SearchToolbar>;

export const Primary: Story = {
    args: {
    },
};
