export const confirmComponentReducer = (state = {props: {}}, action) => {
    switch (action.type) {
        case confirmComponentReducer.SHOW:
            return {...state, props: {...action.props, open: true}};
        case confirmComponentReducer.HIDE:
            return {...state, props: {...state.props, open: false}};
        default:
            return state;
    }
};
confirmComponentReducer.SHOW = "confirmComponent_show";
confirmComponentReducer.HIDE = "confirmComponent_hide";
confirmComponentReducer.skipStore = true;
