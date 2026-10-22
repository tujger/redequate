import {Layout} from "../controllers/General";

const refreshOnVisibilityReducer = (state = {key: null}, action) => {
    switch (action.type) {
        case Layout.REFRESH_CONTENT:
            return {...state, key: Math.random()};
        default:
            return state;
    }
};
refreshOnVisibilityReducer.skipStore = true;

export default refreshOnVisibilityReducer;
