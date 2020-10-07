import {Layout} from "../controllers/General";

export const alertsCounterReducer = (state = {counter: 0}, action) => {
    switch (action.type) {
        case Layout.REFRESH:
            return {...state, random: Math.random()};
        case alertsCounterReducer.VALUE:
            return {...state, counter: action.value};
        case alertsCounterReducer.INCREASE:
            return {...state, counter: (state.counter || 0) + 1};
        case alertsCounterReducer.DECREASE:
            let counter = (state.counter || 0) - 1;
            if (counter < 0) counter = 0;
            return {...state, counter};
        case alertsCounterReducer.RESET:
            return {...state, counter: 0};
        default:
            return state;
    }
};
alertsCounterReducer.DECREASE = "alertsCounter_Decrease";
alertsCounterReducer.INCREASE = "alertsCounter_Increase";
alertsCounterReducer.RESET = "alertsCounter_Reset";
alertsCounterReducer.VALUE = "alertsCounter_Value";
alertsCounterReducer.skipStore = true;
