export const progressViewReducer = (state = {show: false, value: null}, action) => {
    switch (action.type) {
        case progressViewReducer.SHOW.type:
            if (action.value) {
                return {show: true, value: +action.value};
            } else {
                return {show: true, value: null};
            }
        case progressViewReducer.HIDE.type:
            return {show: false, value: null};
        default:
            return state;
    }
};

progressViewReducer.SHOW = {type: "progressView_Show"};
progressViewReducer.HIDE = {type: "progressView_Hide"};
