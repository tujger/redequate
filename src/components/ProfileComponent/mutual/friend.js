import React from "react";
import {MutualComponent, MutualListMode, MutualMode} from "../../MutualComponent";
import {useMetaInfo} from "../../../controllers";
import InfoComponent from "../../InfoComponent";
import MutualLabel from "./MutualLabel";
import MutualListWithItems from "./MutualListWithItems";

export default {
    id: "friend",
    label: "Profile.Friends",
    editComponent: null,
    viewComponent: ({userData}) => {
        const {settings = {}} = useMetaInfo() || {};
        if (!settings?.userProfileFriend) {
            return null;
        }
        return <MutualComponent
            counterComponent={<InfoComponent suffix={"friend(s)"}/>}
            counterRequestsComponent={<InfoComponent suffix={"invite(s)"}/>}
            mutualId={userData.id}
            mutualMode={MutualMode.DUPLEX_APPROVE}
            pendingLabel={"Profile.Waiting for response"}
            subscribeLabel={"Profile.Invite to friends"}
            typeId={"friend"}
            unsubscribeLabel={"Profile.Leave friends"}
        />;
    },
    listComponents: {
        [MutualListMode.SUBSCRIBES]: {
            test: ({userProfileFriend}) => !!userProfileFriend,
            Label: ({userData}) => <MutualLabel
                label={"Profile.Friends"}
                path={[{id: userData.id}, "mutual", {mutual_type: "friend"}]}
            />,
            List: ({header, userData, ...props}) => <MutualListWithItems
                header={header}
                mode={MutualListMode.SUBSCRIBES}
                userData={userData}
                typeId={"friend"}
                {...props}
            />
        },
        [MutualListMode.INVITATIONS]: {
            test: ({isSameUser, isCurrentUserAdmin, userProfileFriend}) => {
                if (!userProfileFriend) return false;
                return isSameUser || isCurrentUserAdmin;
            },
            Label: ({userData}) => <MutualLabel
                label={"Profile.Invitations"}
                path={[{id: userData.id}, "mutualrequests", {mutual_type: "friend"}]}
            />,
            List: ({header, userData, ...props}) => <MutualListWithItems
                header={header}
                mode={MutualListMode.INVITATIONS}
                typeId={"friend"}
                userData={userData}
                unsubscribeLabel={"Profile.Unfollow"}
                {...props}
            />
        },
        [MutualListMode.REQUESTS]: {
            test: ({isSameUser, isCurrentUserAdmin, userProfileFriend}) => {
                if (!userProfileFriend) return false;
                return isSameUser || isCurrentUserAdmin;
            },
            Label: ({userData}) => <MutualLabel
                label={"Profile.Requests"}
                path={[{id: userData.id}, "mutualrequests", {mutual_type: "friend_s"}]}
            />,
            List: ({header, userData, ...props}) => <MutualListWithItems
                header={header}
                mode={MutualListMode.REQUESTS}
                typeId={"friend"}
                userData={userData}
                unsubscribeLabel={"Profile.Unfollow"}
                {...props}
            />,
        },
    }
}
