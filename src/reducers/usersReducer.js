export const usersReducer = (state = {filter: "", mode: "all"}, action) => {
    switch (action.type) {
        case usersReducer.MODE:
            return {...state, filter: action.filter, mode: action.mode};
        default:
            return state;
    }
};
usersReducer.MODE = "users_Mode";
