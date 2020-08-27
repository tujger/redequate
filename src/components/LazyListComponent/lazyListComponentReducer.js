import LazyListComponent from "./LazyListComponent";

export const lazyListComponentReducer = (state = {}, action) => {
    const cache = action.cache;
    const cacheData = action["LazyListComponent_" + cache];
    const savedCacheData = state["LazyListComponent_" + cache] || {};

    switch (action.type) {
        case LazyListComponent._ADD:
            const item = action.item;
            const {items, ascending, reverse} = savedCacheData;
            const newitems = ascending
                ? (reverse ? [item, ...items] : [...items, item])
                : (reverse ? [...items, item] : [item, ...items]);
            return {...state, ["LazyListComponent_" + cache]: {...savedCacheData, items: newitems}};
        case LazyListComponent.EXIT:
            return {...state, ["LazyListComponent_" + cache]: {}};
        case LazyListComponent.RESET:
            if (cache) {
                const cachedData = cacheData || savedCacheData;
                const {pagination} = cachedData;
                if (pagination) pagination.reset();
                return {
                    ...state,
                    ["LazyListComponent_" + cache]: {
                        ...cachedData,
                        random: Math.random(),
                        items: [],
                        loading: false,
                        finished: false
                    }
                };
            } else {
                return {...state, random: Math.random()};
            }
        case LazyListComponent.UPDATE:
            return {...state, ["LazyListComponent_" + cache]: cacheData};
        default:
            return state;
    }
};
lazyListComponentReducer.skipStore = true;
