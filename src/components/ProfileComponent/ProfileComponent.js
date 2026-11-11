import React from "react";
import {useTranslation} from "react-i18next";
import {useCurrentUserDataValue} from "../../controllers";
import AvatarView from "../AvatarView";
import styles from "./styles/ProfileComponent.module.css";

export default (props) => {
    const currentUserData = useCurrentUserDataValue();
    const {userData, privateFields, publicFields} = props;
    const {t} = useTranslation();

    return <div className={styles.profile}>
        {userData.image && <div className={styles.profileFieldImage}>
            <AvatarView
                className={styles.profileImage}
                image={userData.image}
                initials={userData.initials}
                verified={userData.verified}/>
        </div>}
        <div className={styles.profileFields}>
            {Object.entries(publicFields || {}).map(([key, field]) => {
                if (!userData.public[field.id] && !field.viewComponent) return null;
                return <div className={styles.profileField} key={key}>
                    {field.viewComponent
                        ? <field.viewComponent userData={userData}/>
                        : <div className={styles.bodyText}>{userData.public[field.id]}</div>}
                </div>
            })}
            {currentUserData?.id === userData?.id && Object.entries(privateFields || {}).map(([key, field]) => {
                if (!userData.private[field.id] && !field.viewComponent) return null;
                return <div className={styles.profileField} key={key}>
                    {field.viewComponent
                        ? <field.viewComponent userData={userData}/>
                        : <div className={styles.bodyText}>{userData.private[field.id]}</div>}
                </div>
            })}
        </div>
    </div>
};
