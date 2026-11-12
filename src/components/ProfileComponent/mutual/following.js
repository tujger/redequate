import React from "react";
import {MutualComponent, MutualListMode} from "../../MutualComponent";
import {useMetaInfo} from "../../../controllers";
import InfoComponent from "../../InfoComponent";
import MutualLabel from "./MutualLabel";
import MutualListWithItems from "./MutualListWithItems";
import MutualListWithPosts from "./MutualListWithPosts";

export default {
    id: "following",
    label: "Following",
    editComponent: null,
    viewComponent: ({userData}) => {
        const {settings = {}} = useMetaInfo() || {};
        if (!settings?.userProfileFollowing) {
            return null;
        }
        return <MutualComponent
            counterComponent={<InfoComponent suffix={"follower(s)"}/>}
            mutualId={userData.id}
            typeId={"following"}
            subscribeLabel={"Follow"}
            unsubscribeLabel={"Unfollow"}
        />;
    },
    listComponents: {
        [MutualListMode.SUBSCRIBES]: {
            test: ({isSameUser, isCurrentUserAdmin, userProfileFollowing}) => {
                if (!userProfileFollowing) return false;
                return isSameUser || isCurrentUserAdmin;
            },
            Label: ({userData}) => <MutualLabel
                label={"Definitions.Following"}
                path={[{id: userData.id}, "mutual", {mutual_type: "following"}]}
            />,
            List: ({header, userData, ...props}) => <MutualListWithItems
                header={header}
                mode={MutualListMode.SUBSCRIBES}
                typeId={"following"}
                userData={userData}
                unsubscribeLabel={"Tag.Unfollow"}
                {...props}
            />,
        },
        [MutualListMode.STAMPS]: {
            test: ({isCurrentUserAdmin, isSameUser, userProfileFollowing}) => {
                if (!userProfileFollowing) return false;
                return isSameUser || isCurrentUserAdmin;
            },
            Label: ({userData}) => <MutualLabel
                label={"Definitions.Follow"}
                path={[{id: userData.id}, "mutualstamps", {mutual_type: "following"}]}
            />,
            List: ({header, userData, ...props}) => <MutualListWithPosts
                header={header}
                mode={MutualListMode.STAMPS}
                typeId={"following"}
                userData={userData}
                {...props}
            />
        },
        [MutualListMode.SUBSCRIBERS]: {
            test: ({userProfileFollowing}) => !!userProfileFollowing,
            Label: ({userData}) => <MutualLabel
                label={"Definitions.Followers"}
                path={[{id: userData.id}, "mutual", {mutual_type: "following_s"}]}
            />,
            List: ({header, userData, ...props}) => <MutualListWithItems
                header={header}
                mode={MutualListMode.SUBSCRIBERS}
                userData={userData}
                typeId={"following"}
                {...props}
            />,
        }
    }
}
