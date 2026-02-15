import type {Meta, StoryObj} from "@storybook/react";
import Search from "../../pages/search/Search";

Search.displayName = "Search";

const meta: Meta<typeof Search> = {
    component: Search,
    tags: ["autodocs"],
    title: "pages/Search",
} satisfies Meta<typeof Search>;

export default meta;

type Story = StoryObj<typeof Search>;

export const Primary: Story = {
    args: {
    },
};
