import React from "react";
import {InfoComponent} from "../../components";
import {MutualComponent, MutualMode} from "../../components/MutualComponent";
import {useMetaInfo} from "../../controllers";

export default {
    following: {
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
        }
    },
    friend: {
        id: "friend",
        label: "Friends",
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
                pendingLabel={"Waiting for response"}
                subscribeLabel={"Invite to friends"}
                typeId={"friend"}
                unsubscribeLabel={"Leave friends"}
            />;
        }
    }
}
