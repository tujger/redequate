import React from "react";
import {useTranslation} from "react-i18next";
import {MutualComponent, MutualList, MutualListMode, MutualMode} from "../../components/MutualComponent";
import {useBackend, useMetaInfo} from "../../controllers";
import useDatabase from "../../controllers/AppContext/useDatabase";
import {mentionTags, mentionUsers} from "../../controllers/mentionTypes";
import CounterComponent from "../CounterComponent";
import InfoComponent from "../InfoComponent";
import PostComponent from "../PostComponent/PostComponent";
import postItemTransform from "../PostComponent/postItemTransform";

export default {
    _my: {
        listComponents: [
            {
                Label: ({userData}) => <Label
                    label={"Definitions.My Posts"}
                    path={[{id: userData.id}, "mutualstamps", {mutual_type: "_my"}]}
                />,
                List: ({header, userData}) => <ListWithPosts
                    header={header}
                    mode={MutualListMode.SELF}
                    typeId={"_my"}
                    userData={userData}
                />
            }
        ]
    },
    _: {
        listComponents: [
            {
                test: ({isCurrentUserAdmin, isSameUser, userProfileFollowing, userProfileFriend}) => {
                    if (!userProfileFollowing && !userProfileFriend) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => <Label
                    label={"Definitions.Feed"}
                    path={[{id: userData.id}, "mutualstamps", {mutual_type: "_"}]}
                />,
                List: (
                    {
                        header = <><h5>Merges all follow lists.</h5><p/></>,
                        userData
                    }) => <ListWithPosts
                    header={header}
                    mode={MutualListMode.STAMPS}
                    typeId={"_"}
                    userData={userData}
                />,
            }
        ]
    },
    watching: {
        id: "watching",
        label: "Tags",
        listComponents: [
            {
                test: ({isCurrentUserAdmin, isSameUser, userProfileFollowing}) => {
                    if (!userProfileFollowing) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => <Label
                    label={"Definitions.Tags"}
                    path={[{id: userData.id}, "mutual", {mutual_type: "watching"}]}
                />,
                List: ({header, userData}) => {
                    const database = useDatabase();
                    return <ListWithItems
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
                    />
                }
            },
            {
                test: ({isCurrentUserAdmin, isSameUser, userProfileFollowing}) => {
                    if (!userProfileFollowing) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => <Label
                    label={"Definitions.Watching"}
                    path={[{id: userData.id}, "mutualstamps", {mutual_type: "watching"}]}
                />,
                List: ({header, userData}) => <ListWithPosts
                    header={header}
                    mode={MutualListMode.STAMPS}
                    typeId={"watching"}
                    userData={userData}
                />
            },
        ]
    },
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
        },
        listComponents: [
            {
                test: ({isSameUser, isCurrentUserAdmin, userProfileFollowing}) => {
                    if (!userProfileFollowing) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => <Label
                    label={"Definitions.Following"}
                    path={[{id: userData.id}, "mutual", {mutual_type: "following"}]}
                />,
                List: ({header, userData}) => <ListWithItems
                    header={header}
                    mode={MutualListMode.SUBSCRIBES}
                    typeId={"following"}
                    userData={userData}
                    unsubscribeLabel={"Tag.Unfollow"}
                />,
            },
            {
                test: ({isCurrentUserAdmin, isSameUser, userProfileFollowing}) => {
                    if (!userProfileFollowing) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) =>
                    <Label
                        label={"Definitions.Follow"}
                        path={[{id: userData.id}, "mutualstamps", {mutual_type: "following"}]}
                    />,
                List: ({header, userData}) => <ListWithPosts
                    header={header}
                    mode={MutualListMode.STAMPS}
                    typeId={"following"}
                    userData={userData}
                />
            },
            {
                test: ({userProfileFollowing}) => !!userProfileFollowing,
                Label: ({userData}) => <Label
                    label={"Definitions.Followers"}
                    path={[{id: userData.id}, "mutual", {mutual_type: "following_s"}]}
                />,
                List: ({header, userData}) => <ListWithItems
                    header={header}
                    mode={MutualListMode.SUBSCRIBERS}
                    userData={userData}
                    typeId={"following"}
                />,
            }
        ]
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
        },
        listComponents: [
            {
                test: ({userProfileFriend}) => !!userProfileFriend,
                Label: ({userData}) => <Label
                    label={"Definitions.Friends"}
                    path={[{id: userData.id}, "mutual", {mutual_type: "friend"}]}
                />,
                List: ({header, userData}) => <ListWithItems
                    header={header}
                    mode={MutualListMode.SUBSCRIBES}
                    userData={userData}
                    typeId={"friend"}
                />
            },
            {
                test: ({isSameUser, isCurrentUserAdmin, userProfileFriend}) => {
                    if (!userProfileFriend) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => <Label
                    label={"Definitions.Invitations"}
                    path={[{id: userData.id}, "mutualrequests", {mutual_type: "friend"}]}
                />,
                List: ({header, userData}) => <ListWithItems
                    header={header}
                    mode={MutualListMode.INVITATIONS}
                    typeId={"friend"}
                    userData={userData}
                    unsubscribeLabel={"Tag.Unfollow"}
                />
            },
            {
                test: ({isSameUser, isCurrentUserAdmin, userProfileFriend}) => {
                    if (!userProfileFriend) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => <Label
                    label={"Definitions.Requests"}
                    path={[{id: userData.id}, "mutualrequests", {mutual_type: "friend_s"}]}
                />,
                List: ({header, userData}) => <ListWithItems
                    header={header}
                    mode={MutualListMode.REQUESTS}
                    typeId={"friend"}
                    userData={userData}
                    unsubscribeLabel={"Tag.Unfollow"}
                />,
            },
        ]
    },
}

const Label = ({label, path}) => {
    const {t} = useTranslation();
    return <React.Fragment>
        {t(label)}
        <CounterComponent
            // onChange={handleRefresh(typeId, MutualListMode.SUBSCRIBES)}
            live
            path={path}
            prefix={" ("} suffix={")"}/>
    </React.Fragment>
}

const ListWithItems = (
    {
        header = undefined,
        unsubscribeLabel = undefined,
        userData,
        ...props
    }) => {
    const {t} = useTranslation();

    return <>
        {header}
        <MutualList
            mutualId={userData.id}
            unsubscribeLabel={unsubscribeLabel ? t(unsubscribeLabel) : undefined}
            {...props}
        />
    </>
}

const ListWithPosts = (
    {
        header = undefined,
        unsubscribeLabel = undefined,
        userData,
        ...props
    }) => {
    const backend = useBackend();
    const database = useDatabase();
    const {t} = useTranslation();

    const onItemError = (error, options) => {
        console.error(error)
    }

    return <>
        {header}
        <MutualList
            itemComponent={item => <PostComponent
                key={item.id}
                mentions={[mentionUsers, mentionTags]}
                postData={item}
                userData={item._userData}
            />}
            itemTransform={postItemTransform({backend, database, onItemError})}
            mutualId={userData.id}
            unsubscribeLabel={unsubscribeLabel ? t(unsubscribeLabel) : undefined}
            {...props}
        />
    </>
}
