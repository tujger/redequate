import React from "react";
import {useCurrentUserData} from "../controllers/UserData";
import {fetchDeviceId} from "../controllers/General";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import {useTranslation} from "react-i18next";
import notifySnackbar from "../controllers/notifySnackbar";
import {connect} from "react-redux"
import {languageReducer} from "../reducers/languageReducer";

const mapStateToProps = ({language}) => ({
    locale: language.locale,
});

export default connect(mapStateToProps)(({className, dispatch, ...props}) => {
    const currentUserData = useCurrentUserData();
    const {i18n, t} = useTranslation();

    const handleLanguageChange = event => {
        console.log(`[LanguageComponent] change to ${event.target.value}`);
        i18n.changeLanguage(event.target.value);
        if (currentUserData.id) {
            currentUserData.setPrivate(fetchDeviceId(), {locale: event.target.value})
                .then(() => currentUserData.savePrivate())
                .catch(notifySnackbar)
        } else {
            dispatch({type: languageReducer.CHANGE, locale: event.target.value});
        }
    }

    if (!i18n || !i18n.options || !i18n.options.resources || Object.keys(i18n.options.resources).length < 2) return null;
    return <Select
        className={className}
        onChange={handleLanguageChange}
        value={i18n.language || i18n.options.fallbackLng[0]}
        {...props}
    >
        {Object.keys(i18n.store.data).map(item => {
            return <MenuItem value={item} key={item}>{t("Language." + item)}</MenuItem>
        })}
    </Select>
});
