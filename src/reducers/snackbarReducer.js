export const snackbarReducer = (state = {
    open: false,
    buttonText: "Close",
    message: "Snackbar text",
    error: ""
}, action) => {
    switch (action.type) {
        case snackbarReducer.SHOW:
            let newState = {open: true};
            if (action.message) newState.message = action.message;
            if (action.buttonText) newState.buttonText = action.buttonText;
            if (action.onButtonClick) newState.onButtonClick = action.onButtonClick;
            if (action.error) newState.error = action.error;
            return {...state, ...newState};
        case snackbarReducer.HIDE.type:
            return {...state, open: false};
        default:
            return state;
    }
};
snackbarReducer.SHOW = "snackbar_Show";
snackbarReducer.HIDE = {type: "snackbar_Hide"};