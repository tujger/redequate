
import UseAbstract from "./AppContext/UseAbstract";

const currentUserData = new UseAbstract(
    "currentUserData",
    null
);

export const useCurrentUserData = () =>
    currentUserData.useStore();

export const useCurrentUserDataValue = () =>
    currentUserData.useValue();

export const useSetCurrentUserData = () =>
    currentUserData.useSet();

export const getCurrentUserData = state =>
    currentUserData.get(state);
