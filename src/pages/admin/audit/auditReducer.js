import {firebaseMessaging} from "../../../controllers/Firebase";

export const auditReducer = (state = {tabSelected: 0, errorsFilter: undefined, errorsMode: "all", activityFilter: undefined, activityFilterItem: undefined, activityMode: "all", activitySort: "asc"}, action) => {
    switch (action.type) {
        case auditReducer.SAVE:
            return {...state, tabSelected: action.tabSelected};
        case auditReducer.ERRORS:
            return {...state, errorsFilter: action.errorsFilter, errorsMode: action.errorsMode};
        case auditReducer.ACTIVITY:
            return {...state, activityFilterItem: action.activityFilterItem, activityFilter: action.activityFilter, activityMode: action.activityMode, activitySort: action.activitySort};
        default:
            return state;
    }
};
auditReducer.ACTIVITY = "audit_activity";
auditReducer.SAVE = "audit_save";
auditReducer.ERRORS = "audit_errors";

export const updateActivity = async ({uid = 0, type = null, details = null}) => {
    firebaseMessaging.database().ref("activity").push({
        details,
        timestamp: firebaseMessaging.database.ServerValue.TIMESTAMP,
        type,
        uid,
    }).catch(console.error)
}
updateActivity.SERVICE = "service";
updateActivity.MAINTENANCE_START = "maintenance_start";
updateActivity.MAINTENANCE_STOP = "maintenance_stop";
