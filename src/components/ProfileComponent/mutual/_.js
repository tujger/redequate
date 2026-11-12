import React from "react";
import {MutualListMode} from "../../MutualComponent";
import MutualLabel from "./MutualLabel";
import MutualListWithPosts from "./MutualListWithPosts";

export default {
    listComponents: {
        [MutualListMode.STAMPS]: {
            test: ({isCurrentUserAdmin, isSameUser, userProfileFollowing, userProfileFriend}) => {
                if (!userProfileFollowing && !userProfileFriend) return false;
                return isSameUser || isCurrentUserAdmin;
            },
            Label: ({userData}) => <MutualLabel
                label={"Definitions.Feed"}
                path={[{id: userData.id}, "mutualstamps", {mutual_type: "_"}]}
            />,
            List: (
                {
                    header = <><h5>Merges all follow lists.</h5><p/></>,
                    userData,
                    ...props
                }) => <MutualListWithPosts
                header={header}
                mode={MutualListMode.STAMPS}
                typeId={"_"}
                userData={userData}
                {...props}
            />,
        }
    }
}
