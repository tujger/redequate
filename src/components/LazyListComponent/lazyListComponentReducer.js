export const lazyListComponentReducer = (state = {}, action) => {
    const cache = action.cache;
    const cacheData = action["LazyListComponent_" + cache];
    const savedCacheData = state["LazyListComponent_" + cache] || {};

    switch (action.type) {
        case lazyListComponentReducer._ADD: {
            const item = action.item;
            const {items, ascending, reverse} = savedCacheData;
            const newitems = ascending
                ? (reverse ? [item, ...items] : [...items, item])
                : (reverse ? [...items, item] : [item, ...items]);
            return {...state, ["LazyListComponent_" + cache]: {...savedCacheData, refresh: false, items: newitems}};
        }
        case lazyListComponentReducer.EXIT:
            return {...state, ["LazyListComponent_" + cache]: {refresh: false}};
        case lazyListComponentReducer.UPDATE:
            return {...state, ["LazyListComponent_" + cache]: {...cacheData, refresh: false}};
        default:
            return state;
    }
};
lazyListComponentReducer._ADD = "LazyListComponent_add";
lazyListComponentReducer.EXIT = "LazyListComponent_exit";
lazyListComponentReducer.FLUSH = "LazyListComponent_flush";
lazyListComponentReducer.REFRESH = "LazyListComponent_refresh";
lazyListComponentReducer.RESET = "LazyListComponent_reset";
lazyListComponentReducer.UPDATE = "LazyListComponent_update";

lazyListComponentReducer.skipStore = true;
