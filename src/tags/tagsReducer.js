export const tagsReducer = (state = {mode: "all", filter: ""}, action) => {
    switch (action.type) {
        case tagsReducer.MODE:
            return {...state, mode: action.mode, filter: action.filter};
        default:
            return state;
    }
};
tagsReducer.MODE = "tags_Mode";
