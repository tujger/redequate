// moved here from ../Dispatcher.js due to circular dependencies alert
import {Layout} from "../controllers/General";

const dispatcherRoutedBodyReducer = (state = {random: 0}, action) => {
    switch (action.type) {
        case Layout.REFRESH:
            return {...state, random: Math.random()};
        default:
            return state;
    }
};
dispatcherRoutedBodyReducer.skipStore = true;

export default dispatcherRoutedBodyReducer;
