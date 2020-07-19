import React from "react";
import {notifySnackbar} from "../controllers";
import ProgressView from "./ProgressView";
import {connect, useDispatch} from "react-redux";
import {InView} from "react-intersection-observer";

const LazyListComponent = ({
                               cache = false,
                               disableProgress,
                               itemComponent = (item) => <div key={item.key}>
                                   {item.key} - {JSON.stringify(item.value)}
                               </div>,
                               itemTransform = item => item,
                               live = false,
                               noItemsComponent,
                               pagination: givenPagination,
                               placeholder,
                               placeholders = 1,
                               reverse = false,
                               random,
                               ...props
                           }) => {
    const dispatch = useDispatch();
    const {
        ["LazyListComponent_" + cache]: cacheData = {}
    } = props;
    const [state, setState] = React.useState({});
    const {
        finished: cachedFinished = false,
        items: cachedItems = [],
        loading: cachedLoading = false,
        pagination: cachedPagination = givenPagination instanceof Function ? givenPagination() : givenPagination
    } = cacheData;
    const {
        finished = cache ? cachedFinished : false,
        items = cache ? cachedItems : [],
        loading = cache ? cachedLoading : false,
        pagination = cache ? cachedPagination : (givenPagination instanceof Function ? givenPagination() : givenPagination)
    } = state;

    const ascending = pagination.order === "asc";

    // if(pagination.order === "asc" && !reverse) = ascending
    // if(pagination.order === "asc" && reverse) = !ascending
    // if(pagination.order !== "asc" && reverse) = ascending
    // if(pagination.order !== "asc" && !reverse) = !ascending

    if (!placeholder) throw new Error("Placeholder is not defined");

    const loadNextPart = () => {
        if (finished) {
            return;
        }
        if (!disableProgress) dispatch(ProgressView.SHOW);
        return pagination.next()
            .then(async newitems => {
                newitems = newitems.map(async (item, index) => {
                    try {
                        const transformed = await itemTransform(item, index);
                        if (transformed) {
                            return itemComponent(transformed, index);
                        }
                    } catch (error) {
                        console.error(error);
                        // notifySnackbar(error);
                    }
                });
                return Promise.all(newitems);
            })
            .then(newitems => newitems.filter(item => item !== undefined))
            .then(newitems => ({
                    finished: pagination.finished,
                    items: ascending ? (reverse ? [...newitems.reverse(), ...items] : [...items, ...newitems])
                        : (reverse ? [...newitems, ...items] : [...items, ...newitems.reverse()]),
                    // items: (ascending === !reverse) ? [...items, ...newitems] : [...newitems.reverse(), ...items],
                    loading: false,
                    ascending,
                    pagination,
                    reverse
                })
            )
            .catch(error => {
                notifySnackbar({
                    error: error,
                    buttonLabel: "Refresh",
                    onButtonClick: () => dispatch({type: LazyListComponent.RESET, cache}),
                });
                return {
                    finished: true,
                    items: [],
                    loading: false,
                    pagination,
                    reverse
                }
            })
            .then(update => {
                if (cache) {
                    dispatch({
                        type: LazyListComponent.UPDATE,
                        cache: cache,
                        ["LazyListComponent_" + cache]: update
                    });
                } else {
                    setState(state => ({
                        ...state,
                        ...update,
                        loading: false,
                    }))
                }
            })
            .finally(() => {
                if (!disableProgress) dispatch(ProgressView.HIDE);
            });
    };

    React.useEffect(() => {
        const liveAddRef = live ? pagination.ref.limitToLast(1) : null;
        const liveRemoveRef = live ? pagination.ref : null;
        if (live) {
            let lastKey = null;
            liveAddRef.on("child_added", async snapshot => {
                if (!lastKey && !pagination.finished) {
                    lastKey = snapshot.key;
                    return;
                }
                if (lastKey && lastKey > snapshot.key) return;
                lastKey = snapshot.key;
                const item = {key: snapshot.key, value: snapshot.val()};
                const index = Math.random();
                let transformed = await itemTransform(item, index);
                if (transformed) {
                    transformed = itemComponent(transformed, index);
                }
                if (cache) {
                    dispatch({
                        type: LazyListComponent.ADD,
                        cache: cache,
                        item: transformed
                    });
                } else {
                    setState(state => ({
                        ...state,
                        items: ascending
                            ? (reverse ? [transformed, ...state.items] : [...state.items, transformed])
                            : (reverse ? [...state.items, transformed] : [transformed, ...state.items])
                        // ...update,
                        // loading: false,
                    }))
                }
            });
            liveRemoveRef.on("child_removed", async snapshot => {
                if(cache) dispatch({type: LazyListComponent.RESET, cache});
                else dispatch({type: LazyListComponent.RESET});
            });
        }
        return () => {
            liveAddRef && liveAddRef.off();
            liveRemoveRef && liveRemoveRef.off();
            if (!disableProgress) dispatch(ProgressView.HIDE);
        }
        // eslint-disable-next-line
    }, [pagination, givenPagination.term]);

    React.useEffect(() => {
        if (cache) return;
        // pagination && pagination.reset();
        setState(state => ({
            ...state,
            items: [],
            loading: false,
            finished: false,
            pagination: (givenPagination instanceof Function ? givenPagination() : givenPagination)
        }));
    }, [random, givenPagination.term])

    if (items.length) console.log(`[Lazy] loaded ${items.length} items${cache ? " on " + cache : ""}`);
    return <React.Fragment>
        {reverse && <Observer
            finished={finished}
            hasItems={items.length}
            key={items.length}
            loadNextPage={loadNextPart}
            placeholder={placeholder}
            placeholders={placeholders}
        />}
        {items}
        {!reverse && <Observer
            finished={finished}
            hasItems={items.length}
            key={items.length}
            loadNextPage={loadNextPart}
            placeholder={placeholder}
            placeholders={placeholders}
        />}
        {!items.length && finished && noItemsComponent}
    </React.Fragment>
};

const Observer = ({finished, hasItems, loadNextPage, placeholder, placeholders}) => {
    if (finished) return null;
    return <React.Fragment>
        <InView
            onChange={(inView) => {
                if (inView) loadNextPage();
            }}
            ref={ref => {
                if (!ref) return;
                setTimeout(() => {
                    if (ref && ref.node) ref.node.style.display = "";
                }, hasItems ? 1500 : 0)
            }}
            style={{width: "100%", display: "none"}}
        />
        {(() => {
            const a = [];
            for (let i = 0; i < placeholders; i++) {
                a.push(i)
            }
            return a;
        })().map((item, index) => <placeholder.type {...placeholder.props} key={index}/>)}
    </React.Fragment>
}

export const lazyListComponent = (state = {}, action) => {
    const cache = action.cache;
    const cacheData = action["LazyListComponent_" + cache];
    switch (action.type) {
        case LazyListComponent.ADD:
            const item = action.item;
            const savedCacheData = state["LazyListComponent_" + cache];
            const {items, ascending, reverse} = savedCacheData;
            const newitems = ascending
                ? (reverse ? [item, ...items] : [...items, item])
                : (reverse ? [...items, item] : [item, ...items]);
            return {...state, ["LazyListComponent_" + cache]: {...savedCacheData, items: newitems}};
        case LazyListComponent.EXIT:
            return {...state, ["LazyListComponent_" + cache]: {}};
        case LazyListComponent.RESET:
            if (cache) {
                const {pagination} = cacheData || state["LazyListComponent_" + cache] || {};
                if (pagination) pagination.reset();
                return {...state, ["LazyListComponent_" + cache]: {items: [], loading: false, finished: false}};
            } else {
                return {...state, random: Math.random()};
            }
        case LazyListComponent.UPDATE:
            return {...state, ["LazyListComponent_" + cache]: cacheData};
        default:
            return state;
    }
};
lazyListComponent.skipStore = true;

LazyListComponent.ADD = "LazyListComponent_add";
LazyListComponent.EXIT = "LazyListComponent_exit";
LazyListComponent.RESET = "LazyListComponent_reset";
LazyListComponent.UPDATE = "LazyListComponent_update";

const mapStateToProps = ({lazyListComponent, ...rest}) => {
    return {...lazyListComponent};
}

export default connect(mapStateToProps)(LazyListComponent);
