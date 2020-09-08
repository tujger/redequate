import React from "react";
import {notifySnackbar} from "../../controllers/Notifications";
import {connect, useDispatch} from "react-redux";
import PropTypes from "prop-types";
import {Observer} from "./Observer";
import {Scroller} from "./Scroller";
import {forceFirebaseReinit} from "../../controllers/Firebase";
import {lazyListReducer} from "../../reducers/lazyListReducer";
import {progressViewReducer} from "../../reducers/progressViewReducer";

function LazyListComponent(
    {
        cache = false,
        containerRef,
        disableProgress,
        itemComponent = (item) => <div key={item.key}>
            {item.key} - {JSON.stringify(item.value)}
        </div>,
        itemTransform = item => item,
        live = false,
        noItemsComponent,
        pageTransform = items => items,
        pagination: sourcePagination,
        placeholder,
        placeholders = 1,
        random,
        reverse = false,
        ["LazyListComponent_" + cache]: cacheData = {},
    }) {
    const dispatch = useDispatch();
    const [state, setState] = React.useState({});
    const {
        finished: cachedFinished = false,
        items: cachedItems = [],
        loading: cachedLoading = true,
        pagination: cachedPagination = sourcePagination instanceof Function ? sourcePagination() : sourcePagination
    } = cacheData;
    const {
        finished = cache !== undefined ? cachedFinished : false,
        items = cache !== undefined ? cachedItems : [],
        loading = cache !== undefined ? cachedLoading : true,
        pagination = cachedPagination
    } = state;

    const ascending = pagination.order === "asc";

    const loadNextPage = () => {
        if (finished) {
            return;
        }
        if (!disableProgress) dispatch(progressViewReducer.SHOW);

        let before = null;
        if (reverse && containerRef && containerRef.current) {
            before = containerRef.current.scrollHeight;
        }

        return pagination.next()
            .then(async newitems => {
                newitems = newitems.map(async (item, index) => {
                    let transformed;
                    try {
                        transformed = await itemTransform(item, index);
                    } catch (error) {
                        console.error(error);
                    }
                    if (transformed) {
                        try {
                            return itemComponent(transformed, index);
                        } catch (error) {
                            console.error(error);
                        }
                    }
                });
                return Promise.all(newitems);
            })
            .then(newitems => pageTransform(newitems))
            .then(newitems => newitems.filter(item => item !== undefined))
            .then(newitems => ({
                ascending,
                finished: pagination.finished,
                items: ascending
                    ? (reverse ? [...newitems.reverse(), ...items] : [...items, ...newitems])
                    : (reverse ? [...newitems, ...items] : [...items, ...newitems.reverse()]),
                loading: false,
                pagination,
                reverse
            }))
            .catch(error => {
                notifySnackbar({
                    buttonLabel: "Refresh",
                    error: error,
                    onButtonClick: () => {
                        forceFirebaseReinit();
                        window.location.reload()
                    },
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
                        type: lazyListReducer.UPDATE,
                        cache: cache,
                        ["LazyListComponent_" + cache]: update
                    });
                } else {
                    setState(state => ({
                        ...state,
                        ...update,
                    }))
                }
            })
            .finally(() => {
                setTimeout(() => {
                    if (reverse && containerRef && containerRef.current) {
                        const after = containerRef.current.scrollHeight;
                        containerRef.current.scrollBy({left: 0, top: after - before});
                    }
                }, 100)
                if (!disableProgress) dispatch(progressViewReducer.HIDE);
            });
    };

    React.useEffect(() => {
        let isMounted = true;
        const liveAddRef = live ? pagination.ref.limitToLast(1) : null;
        const liveRemoveRef = live ? pagination.ref : null;

        let lastKey = null;
        const liveAddListener = async snapshot => {
            if (!isMounted) return;
            if (!lastKey && !cachedPagination.finished) {
                lastKey = snapshot.key;
                return;
            }
            if (lastKey && lastKey > snapshot.key) return;
            lastKey = snapshot.key;
            const item = {key: snapshot.key, value: snapshot.val()};
            const index = Math.random();
            let transformed = await itemTransform(item, snapshot.key);
            if (transformed) {
                transformed = itemComponent(transformed, snapshot.key);
            }
            if (cache) {
                dispatch({
                    type: lazyListReducer._ADD,
                    cache: cache,
                    item: transformed
                });
            } else {
                isMounted && setState(state => ({
                    ...state,
                    items: ascending
                        ? (reverse ? [transformed, ...state.items] : [...state.items, transformed])
                        : (reverse ? [...state.items, transformed] : [transformed, ...state.items])
                }))
            }
        }

        const liveRemoveListener = async snapshot => {
            if (!isMounted) return;
            if (cache) dispatch({type: lazyListReducer.RESET, cache});
            else dispatch({type: lazyListReducer.RESET});
        }

        if (live) {
            liveAddRef.on("child_added", liveAddListener);
            liveRemoveRef.on("child_removed", liveRemoveListener);
        }
        return () => {
            liveAddRef && liveAddRef.off("child_added", liveAddListener);
            liveRemoveRef && liveRemoveRef.off("child_removed", liveRemoveListener);
            if (!disableProgress) dispatch(progressViewReducer.HIDE);
            if (!cache) pagination.reset();
            isMounted = false;
        }
    }, [pagination.term, cachedPagination.term]);

    React.useEffect(() => {
        if (cache) return;
        cachedPagination.reset();
        const update = {
            finished: false,
            items: [],
            loading: true,
            pagination: cachedPagination,
            reverse
        }
        setState(state => ({
            ...state,
            ...update,
        }))
    }, [random, pagination.term, cachedPagination.term])

    if (reverse === true && !containerRef) {
        throw new Error("[Lazy] 'containerRef' must be defined due to 'reverse'=true")
    }
    if (items.length) console.log(`[Lazy] loaded ${items.length} items${cache ? " on " + cache : ""}`);

    return <React.Fragment>
        {reverse && <Observer
            finished={finished}
            hasItems={items.length}
            key={items.length}
            loadNextPage={loadNextPage}
            placeholder={placeholder}
            placeholders={placeholders}
        />}
        {items}
        {!reverse && <Observer
            finished={finished}
            hasItems={items.length}
            key={items.length}
            loadNextPage={loadNextPage}
            placeholder={placeholder}
            placeholders={placeholders}
        />}
        <Scroller live={live && !ascending && reverse} placeholder={placeholder}/>
        {!items.length && finished && noItemsComponent}
    </React.Fragment>
}

LazyListComponent.propTypes = {
    cache: PropTypes.string,
    disableProgress: PropTypes.bool,
    itemComponent: PropTypes.func,
    itemTransform: PropTypes.func,
    live: PropTypes.bool,
    noItemsComponent: PropTypes.object,
    pageTransform: PropTypes.func,
    pagination: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.func]).isRequired,
    placeholder: PropTypes.element.isRequired,
    placeholders: PropTypes.number,
    reverse: PropTypes.bool,
}

const mapStateToProps = ({lazyListReducer}) => {
    return {...lazyListReducer};
}

export default connect(mapStateToProps)(LazyListComponent)
