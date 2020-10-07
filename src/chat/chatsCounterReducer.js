import {Layout} from "../controllers/General";

export const chatsCounterReducer = (state = {counter: 0}, action) => {
    switch (action.type) {
        case chatsCounterReducer.COUNTER:
            return {...state, counter: action.counter};
        case Layout.REFRESH:
            return {...state, random: Math.random()};
        default:
            return state;
    }
};
chatsCounterReducer.COUNTER = "chatsCounter_Counter";
chatsCounterReducer.skipStore = true;
