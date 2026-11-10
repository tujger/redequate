import React from "react";
import {useTranslation} from "react-i18next";
import LoadingComponent from "../../components/LoadingComponent";
import {
    matchRole,
    useCurrentUserDataValue,
    useDatabase,
    useMetaInfo,
    useRedirectToLogin,
    UserRole
} from "../../controllers";
import Tabs from "../../controls/Tabs/Tabs";
import baseStyles from "../../themes/Base.module.css";
import {MutualError, MutualList, MutualListMode} from "../MutualComponent";
import styles from "./styles/ProfileComponent.module.css";

export default (props) => {
    const {userData, publicFields = {}} = props;
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const {settings = {}} = useMetaInfo() || {};
    const shouldRedirectToLogin = useRedirectToLogin();
    const [state, setState] = React.useState({
        tab: 0,
    });
    const {t} = useTranslation();

    const isSameUser = userData && currentUserData && userData.id === currentUserData.id;
    const isCurrentUserAdmin = matchRole([UserRole.ADMIN], currentUserData);
    const {tab} = state;

    const handleChangeTab = tab => {
        setState(state => ({...state, tab}));
    };

    let value = 0;
    const items = Object.entries(publicFields || {}).flatMap(([_, field]) => {
        if (!field.listComponents) return [];
        return field.listComponents.map(({Label, List, test}) => {
            if (test?.({
                ...settings,
                isCurrentUserAdmin,
                isSameUser
            }) === false) return null;
            return {
                label: <Label
                    userData={userData}
                    userProfileFollowing={settings.userProfileFollowing}
                    userProfileFriend={settings.userProfileFriend}
                />,
                List,
                value: value++,
            };
        })
    }).filter(Boolean);

    const onPostError = type => (error, options) => {
        if (options.code === MutualError.NOT_FOUND) {
            console.error(error);
        }
    }

    if (shouldRedirectToLogin) return <LoadingComponent/>;
    const selectedTab = items.find(item => item.value === tab);

    const config = items[tab] || items[0];

    return <div className={baseStyles.content}>
        <Tabs
            className={styles.root}
            items={items}
            onChange={handleChangeTab}
            value={tab}
        />
        <div
            aria-label={selectedTab ? selectedTab.label : "Settings"}
            className={styles.options}
            id={"settings-panel"}
            role={"tabpanel"}
        >
            {config?.List && <config.List
                userData={userData}
            />}
            {config && !config.List && <MutualList
                cached={true}
                mutualId={userData.id}
                mode={MutualListMode.STAMPS}
                {...config}
                itemTransform={config.itemTransform?.({database, onItemError: onPostError(config.typeId)})}
            />}
        </div>
    </div>
};
