import type {Meta, StoryObj} from "@storybook/react";
import AvatarView from "../../components/AvatarView";

AvatarView.displayName = "AvatarView";

const meta: Meta<typeof AvatarView> = {
    component: AvatarView,
    tags: ["autodocs"],
    title: "components/AvatarView",
} satisfies Meta<typeof AvatarView>;

export default meta;

type Story = StoryObj<typeof AvatarView>;

export const Primary: Story = {
    args: {
        admin: false,
        className: "",
        image: "",
        icon: "",
        initials: "FL",
        onclick: undefined,
        verified: false,
    },
};
