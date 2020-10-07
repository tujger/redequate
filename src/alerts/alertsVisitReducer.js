export const alertsVisitReducer = (state = {timestamp: 0}, action) => {
    switch (action.type) {
        case alertsVisitReducer.UPDATE:
            return {...state, timestamp: new Date().getTime()};
        default:
            return state;
    }
};
alertsVisitReducer.UPDATE = "alertsVisit_Update";
