export const lazyListComponentReducer = (state = {}, action) => {
    const cache = action.cache;
    const cacheData = action["LazyListComponent_" + cache];
    const savedCacheData = state["LazyListComponent_" + cache] || {};

    switch (action.type) {
        case lazyListComponentReducer._ADD:
            const item = action.item;
            const {items, ascending, reverse} = savedCacheData;
            const newitems = ascending
                ? (reverse ? [item, ...items] : [...items, item])
                : (reverse ? [...items, item] : [item, ...items]);
            return {...state, ["LazyListComponent_" + cache]: {...savedCacheData, items: newitems}};
        case lazyListComponentReducer.EXIT:
            return {...state, ["LazyListComponent_" + cache]: {}};
        case lazyListComponentReducer.RESET:
            if (cache) {
                const cachedData = cacheData || savedCacheData;
                if (action.pagination) {
                    cachedData.pagination = action.pagination;
                }
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
        case lazyListComponentReducer.UPDATE:
            return {...state, ["LazyListComponent_" + cache]: cacheData};
        default:
            return state;
    }
};
lazyListComponentReducer._ADD = "LazyListComponent_add";
lazyListComponentReducer.EXIT = "LazyListComponent_exit";
lazyListComponentReducer.RESET = "LazyListComponent_reset";
lazyListComponentReducer.UPDATE = "LazyListComponent_update";

lazyListComponentReducer.skipStore = true;
