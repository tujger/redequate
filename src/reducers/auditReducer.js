export const auditReducer = (state = {tabSelected: 0}, action) => {
    switch (action.type) {
        case auditReducer.SAVE:
            return {...state, tabSelected: action.tabSelected};
        default:
            return state;
    }
};
auditReducer.SAVE = "audit_save";
