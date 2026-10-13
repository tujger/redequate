import React from "react";
import {useTranslation} from "react-i18next";
import {connect} from "react-redux"
import {fetchDeviceId} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserData} from "../controllers/useCurrentUserData";
import {UserData} from "../controllers/UserData";
import {useDatabase} from "../controllers";
import Select from "../controls/Select/Select";
import {languageReducer} from "../reducers/languageReducer";

const mapStateToProps = ({language}) => ({
    locale: language.locale,
});

export default connect(mapStateToProps)(({className, dispatch, ...props}) => {
    const [currentUserData, setCurrentUserData] = useCurrentUserData();
    const database = useDatabase();
    const {i18n, t} = useTranslation();

    const handleLanguageChange = event => {
        console.log(`[LanguageComponent] change to ${event.target.value}`);
        i18n.changeLanguage(event.target.value);
        if (currentUserData.id) {
            const userData = new UserData(database).fromJSON(currentUserData.toJSON());
            userData.setPrivate(fetchDeviceId(), {locale: event.target.value})
                .then(() => userData.savePrivate())
                .then(() => setCurrentUserData(userData))
                .catch(notifySnackbar)
        } else {
            dispatch({type: languageReducer.CHANGE, locale: event.target.value});
        }
    }

    if (!i18n || !i18n.options || !i18n.options.resources || Object.keys(i18n.options.resources).length < 2) return null;

    return <Select
        className={className}
        color={"inherit"}
        onChange={handleLanguageChange}
        options={Object.keys(i18n.store.data).map(item => ({
            label: t("Language." + item),
            value: item,
        }))}
        value={i18n.resolvedLanguage || i18n.languages.find(language => i18n.options.resources[language]) || i18n.language || i18n.options.fallbackLng[0]}
        {...props}
    />
});
