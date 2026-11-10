import React from "react";
import {useTranslation} from "react-i18next";
import {InfoComponent, mentionTags, mentionUsers, postItemTransform} from "../../components";
import {MutualComponent, MutualList, MutualListMode, MutualMode} from "../../components/MutualComponent";
import {useMetaInfo} from "../../controllers";
import useDatabase from "../../controllers/AppContext/useDatabase";
import CounterComponent from "../CounterComponent";
import PostComponent from "../PostComponent/PostComponent";

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
                        itemTransform={postItemTransform({database, onItemError})}
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
                        itemTransform={postItemTransform({database, onItemError})}
                        mode={MutualListMode.STAMPS}
                        mutualId={userData.id}
                        typeId={"_"}
                    />
                }
            }
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
    }
}
