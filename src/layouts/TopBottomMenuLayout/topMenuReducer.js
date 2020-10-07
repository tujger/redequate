import {MenuBadge} from "../../controllers/General";

export const topMenuReducer = (state = {page: null, badge: {}}, action) => {
    let id;
    switch (action.type) {
        case MenuBadge.INCREASE:
            id = action.page.route;
            return {...state, badge: {...state.badge, [id]: (state.badge[id] || 0) + 1}};
        case MenuBadge.DECREASE:
            id = action.page.route;
            return {...state, badge: {...state.badge, [id]: (state.badge[id] || 0) - 1}};
        case MenuBadge.RESET:
            id = action.page && action.page.route;
            if (id) return {...state, badge: {...state.badge, [id]: 0}};
            else return {...state, badge: {}};
        default:
            return state;
    }
};
topMenuReducer.skipStore = true;
