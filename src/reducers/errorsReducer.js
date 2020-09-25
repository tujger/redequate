export const errorsReducer = (state = {filter: "", mode: "all"}, action) => {
    switch (action.type) {
        case errorsReducer.MODE:
            return {...state, filter: action.filter, mode: action.mode};
        default:
            return state;
    }
};
errorsReducer.MODE = "errors_Mode";
errorsReducer.skipStore = true;
