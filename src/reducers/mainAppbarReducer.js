import {Layout, MenuBadge} from "../controllers/General";

export const mainAppbarReducer = (state = {label: "", badge: 0}, action) => {
    switch (action.type) {
        case Layout.TITLE:
            return {...state, label: action.label};
        case MenuBadge.DECREASE:
            return {...state, badge: (state.badge || 0) - 1};
        case MenuBadge.INCREASE:
            return {...state, badge: (state.badge || 0) + 1};
        case MenuBadge.RESET:
            return {...state, badge: 0};
        default:
            return state;
    }
};
mainAppbarReducer.skipStore = true;
