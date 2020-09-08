export const lazyListReducer = (state = {}, action) => {
    const cache = action.cache;
    const cacheData = action["LazyListComponent_" + cache];
    const savedCacheData = state["LazyListComponent_" + cache] || {};

    switch (action.type) {
        case lazyListReducer._ADD:
            const item = action.item;
            const {items, ascending, reverse} = savedCacheData;
            const newitems = ascending
                ? (reverse ? [item, ...items] : [...items, item])
                : (reverse ? [...items, item] : [item, ...items]);
            return {...state, ["LazyListComponent_" + cache]: {...savedCacheData, items: newitems}};
        case lazyListReducer.EXIT:
            return {...state, ["LazyListComponent_" + cache]: {}};
        case lazyListReducer.RESET:
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
        case lazyListReducer.UPDATE:
            return {...state, ["LazyListComponent_" + cache]: cacheData};
        default:
            return state;
    }
};
lazyListReducer._ADD = "LazyListComponent_add";
lazyListReducer.EXIT = "LazyListComponent_exit";
lazyListReducer.RESET = "LazyListComponent_reset";
lazyListReducer.UPDATE = "LazyListComponent_update";

lazyListReducer.skipStore = true;
