import React from "react";
import {MutualListMode} from "../../MutualComponent";
import MutualLabel from "./MutualLabel";
import MutualListWithPosts from "./MutualListWithPosts";

export default {
    listComponents: {
        [MutualListMode.SELF]: {
            test: ({isCurrentUserAdmin, isSameUser}) => {
                return isSameUser || isCurrentUserAdmin;
            },
            Label: ({userData}) => <MutualLabel
                label={"Definitions.My Posts"}
                path={[{id: userData.id}, "mutualstamps", {mutual_type: "_my"}]}
            />,
            List: ({header, userData, ...props}) => <MutualListWithPosts
                header={header}
                mode={MutualListMode.SELF}
                typeId={"_my"}
                userData={userData}
                {...props}
            />
        }
    }
}
