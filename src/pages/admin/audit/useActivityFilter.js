import UseAbstract from "../../../controllers/AppContext/UseAbstract";

const activityFilterStore = new UseAbstract("activityFilter", {
    activityFilter: undefined,
    activityFilterItem: undefined,
    activityMode: "all",
    activitySort: "asc"
});

export default () =>
    activityFilterStore.useStore();

export const useActivityFilterValue = () =>
    activityFilterStore.useValue();

export const useSetActivityFilter = () =>
    activityFilterStore.useSet();

export const getActivityFilter = state =>
    activityFilterStore.get(state);
