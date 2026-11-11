import React from "react";
import {MutualListMode} from "../../MutualComponent";
import useDatabase from "../../../controllers/AppContext/useDatabase";
import MutualLabel from "./MutualLabel";
import MutualListWithItems from "./MutualListWithItems";
import MutualListWithPosts from "./MutualListWithPosts";

export default {
    id: "watching",
    label: "Tags",
    listComponents: [
        {
            test: ({isCurrentUserAdmin, isSameUser, userProfileFollowing}) => {
                if (!userProfileFollowing) return false;
                return isSameUser || isCurrentUserAdmin;
            },
            Label: ({userData}) => <MutualLabel
                label={"Definitions.Tags"}
                path={[{id: userData.id}, "mutual", {mutual_type: "watching"}]}
            />,
            List: ({header, userData, ...props}) => {
                const database = useDatabase();
                return <MutualListWithItems
                    header={header}
                    itemTransform={item => {
                        return database.read([item.value.type, {tag_id: item.value.id}])
                            .then(value => {
                                if (value !== undefined) {
                                    return {
                                        key: item.key,
                                        value: item.value,
                                        userData: {
                                            name: value.label,
                                            image: value.image || "",
                                            initials: value.label,
                                        },
                                    };
                                }
                            })
                    }}
                    mode={MutualListMode.SUBSCRIBES}
                    typeId={"watching"}
                    userData={userData}
                    unsubscribeLabel={"Tag.Unfollow"}
                    {...props}
                />
            }
        },
        {
            test: ({isCurrentUserAdmin, isSameUser, userProfileFollowing}) => {
                if (!userProfileFollowing) return false;
                return isSameUser || isCurrentUserAdmin;
            },
            Label: ({userData}) => <MutualLabel
                label={"Definitions.Watching"}
                path={[{id: userData.id}, "mutualstamps", {mutual_type: "watching"}]}
            />,
            List: ({header, userData, ...props}) => <MutualListWithPosts
                header={header}
                mode={MutualListMode.STAMPS}
                typeId={"watching"}
                userData={userData}
                {...props}
            />
        },
    ]
}
