import {MenuBadge} from "../controllers/General";

export const topMenuReducer = (state = {page: null, badge: {}}, action) => {
    switch (action.type) {
        case MenuBadge.INCREASE:
            const id = action.page.route;
            return {...state, badge: {...state.badge, [id]: (state.badge[id] || 0) + 1}};
        case MenuBadge.DECREASE:
            const id1 = action.page.route;
            return {...state, badge: {...state.badge, [id1]: (state.badge[id1] || 0) - 1}};
        case MenuBadge.RESET:
            const id2 = action.page && action.page.route;
            if (id2) return {...state, badge: {...state.badge, [id2]: 0}};
            else return {...state, badge: {}};
        default:
            return state;
    }
};
topMenuReducer.skipStore = true;
