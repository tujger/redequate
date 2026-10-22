import UseAbstract from "./AppContext/UseAbstract";
import UserData from "./UserData";

class CurrentUserData extends UseAbstract {
    _normalize(value) {
        return value ?? new UserData();
    }
}

const currentUserData = new CurrentUserData("currentUserData", new UserData());

export default () =>
    currentUserData.useStore();

export const useCurrentUserDataValue = () =>
    currentUserData.useValue();

export const useSetCurrentUserData = () =>
    currentUserData.useSet();

export const getCurrentUserData = state =>
    currentUserData.get(state);
