export const newPostComponentReducer = (state = {
    _savedText: "",
    _savedContext: null
}, action) => {
    switch (action.type) {
        case newPostComponentReducer.SAVE:
            return {...state, _savedText: action._savedText, _savedContext: action._savedContext};
        default:
            return state;
    }
};
newPostComponentReducer.SAVE = "newPostComponent_Save";
