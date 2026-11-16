import UseAbstract from "../../../controllers/AppContext/UseAbstract";

const errorsFilterStore = new UseAbstract("errorsFilter", {
    errorsFilter: undefined,
    errorsMode: "all",
});

export default () =>
    errorsFilterStore.useStore();

export const useErrorsFilterValue = () =>
    errorsFilterStore.useValue();

export const useSetErrorsFilter = () =>
    errorsFilterStore.useSet();

export const getErrorsFilter = state =>
    errorsFilterStore.get(state);
