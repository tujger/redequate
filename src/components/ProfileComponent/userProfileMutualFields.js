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
                Label: ({userData}) => {
                    const {t} = useTranslation();
                    return <React.Fragment>
                        {t("Definitions.Posts")}
                        <CounterComponent
                            // onChange={handleRefresh(typeId, MutualListMode.SELF)}
                            path={[{id: userData.id}, "mutualstamps", {mutual_type: "_my"}]}
                            prefix={" ("} suffix={")"}/>
                    </React.Fragment>
                },
                List: ({userData}) => {
                    const backend = useBackend();
                    const database = useDatabase();

                    const onItemError = (error, options) => {
                        console.error(error)
                    }

                    return <MutualList
                        itemComponent={item => <PostComponent
                            key={item.id}
                            mentions={[mentionUsers, mentionTags]}
                            postData={item}
                            userData={item._userData}
                        />}
                        itemTransform={postItemTransform({backend, database, onItemError})}
                        mode={MutualListMode.SELF}
                        mutualId={userData.id}
                        typeId={"_my"}
                    />
                }
            }
        ]
    },
    _: {
        listComponents: [
            {
                test: ({isSameUser}) => !!isSameUser,
                Label: ({userData}) => {
                    const {t} = useTranslation();
                    return <React.Fragment>
                        Feed
                        <CounterComponent
                            // onChange={handleRefresh("_", MutualListMode.STAMPS)}
                            path={[{id: userData.id}, "mutualstamps", "_"]}
                            prefix={" ("} suffix={")"}/>
                    </React.Fragment>
                },
                List: ({userData}) => {
                    const backend = useBackend();
                    const database = useDatabase();

                    const onItemError = (error, options) => {
                        console.error(error)
                    }

                    return <MutualList
                        itemComponent={item => <PostComponent
                            key={item.id}
                            mentions={[mentionUsers, mentionTags]}
                            postData={item}
                            userData={item._userData}
                        />}
                        itemTransform={postItemTransform({backend, database, onItemError})}
                        mode={MutualListMode.STAMPS}
                        mutualId={userData.id}
                        typeId={"_"}
                    />
                }
            }
        ]
    },
    watching: {
        id: "watching",
        label: "Tags",
        listComponents: [
            {
                test: ({isCurrentUserAdmin, isSameUser}) => {
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => {
                    return <React.Fragment>
                        Tags
                        <CounterComponent
                            // onChange={handleRefresh(typeId, MutualListMode.SUBSCRIBES)}
                            live
                            path={[{id: userData.id}, "mutual", {mutual_type: "watching"}]}
                            prefix={" ("} suffix={")"}/>
                    </React.Fragment>
                },
                List: ({userData}) => {
                    const database = useDatabase();
                    const {t} = useTranslation();
                    return <MutualList
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
                        mutualId={userData.id}
                        typeId={"watching"}
                        unsubscribeLabel={t("Tag.Unfollow")}
                    />
                }
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
                Label: ({userData}) => {
                    return <React.Fragment>
                        Following
                        <CounterComponent
                            // onChange={handleRefresh(typeId, MutualListMode.SUBSCRIBES)}
                            live
                            path={[{id: userData.id}, "mutual", {mutual_type: "following"}]}
                            prefix={" ("} suffix={")"}/>
                    </React.Fragment>
                },
                List: ({userData}) => {
                    const {t} = useTranslation();
                    return <MutualList
                        mutualId={userData.id}
                        mode={MutualListMode.SUBSCRIBES}
                        typeId={"following"}
                        unsubscribeLabel={t("Tag.Unfollow")}
                    />
                }
            },
            {
                test: ({userProfileFollowing}) => !!userProfileFollowing,
                Label: ({userData}) => {
                    return <React.Fragment>
                        Followers
                        <CounterComponent
                            // onChange={handleRefresh(typeId, MutualListMode.SUBSCRIBES)}
                            live
                            path={[{id: userData.id}, "mutual", {mutual_type: "following_s"}]}
                            prefix={" ("} suffix={")"}/>
                    </React.Fragment>
                },
                List: ({userData}) => {
                    return <MutualList
                        mutualId={userData.id}
                        mode={MutualListMode.SUBSCRIBERS}
                        typeId={"following"}
                    />
                }
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
                Label: ({userData}) => {
                    const {t} = useTranslation();
                    return <React.Fragment>
                        Friends
                        <CounterComponent
                            // onChange={handleRefresh(typeId, MutualListMode.SUBSCRIBES)}
                            live
                            path={[{id: userData.id}, "mutual", {mutual_type: "friend"}]}
                            prefix={" ("} suffix={")"}/>
                    </React.Fragment>
                },
                List: ({userData}) => {
                    return <MutualList
                        cached={true}
                        mutualId={userData.id}
                        mode={MutualListMode.SUBSCRIBES}
                        typeId={"friend"}
                    />
                }
            },
            {
                test: ({isSameUser, isCurrentUserAdmin, userProfileFollowing}) => {
                    if (!userProfileFollowing) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => {
                    const {t} = useTranslation();
                    return <React.Fragment>
                        Invitations
                        <CounterComponent
                            // onChange={handleRefresh(typeId, MutualListMode.SUBSCRIBES)}
                            live
                            path={[{id: userData.id}, "mutualrequests", {mutual_type: "friend"}]}
                            prefix={" ("} suffix={")"}/>
                    </React.Fragment>
                },
                List: ({userData}) => {
                    return <MutualList
                        cached={true}
                        mutualId={userData.id}
                        mode={MutualListMode.INVITATIONS}
                        typeId={"friend"}
                    />
                }
            },
            {
                test: ({isSameUser, isCurrentUserAdmin, userProfileFollowing}) => {
                    if (!userProfileFollowing) return false;
                    return isSameUser || isCurrentUserAdmin;
                },
                Label: ({userData}) => {
                    const {t} = useTranslation();
                    return <React.Fragment>
                        Requests
                    </React.Fragment>
                },
                List: ({userData}) => {
                    return <MutualList
                        cached={true}
                        mutualId={userData.id}
                        mode={MutualListMode.REQUESTS}
                        typeId={"friend"}
                    />
                }
            },
        ]
    },
}
