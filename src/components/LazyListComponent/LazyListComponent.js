import React from "react";
import ProgressView from "../ProgressView";
import {connect, useDispatch} from "react-redux";
import PropTypes from "prop-types";
import {Observer} from "./Observer";
import {Scroller} from "./Scroller";
import {forceFirebaseReinit} from "../../controllers/Firebase";
import {notifySnackbar} from "../../controllers/notifySnackbar";
import {lazyListComponentReducer} from "./lazyListComponentReducer";
import {useHistory} from "react-router-dom";

function LazyListComponent(
    {
        autoRefresh = true,
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
        scrollerClassName,
        ItemProps = {},
        ["LazyListComponent_" + cache]: cacheData = {},
    }) {
    const dispatch = useDispatch();
    const history = useHistory();
    const [state, setState] = React.useState({});
    const {
        finished: cachedFinished = false,
        items: cachedItems = [],
        loading: cachedLoading = true,
        pagination: cachedPagination = sourcePagination instanceof Function ? sourcePagination() : sourcePagination,
        refresh
    } = cacheData;
    const {
        finished = cache !== undefined ? cachedFinished : false,
        items = cache !== undefined ? cachedItems : [],
        loading = cache !== undefined ? cachedLoading : true,
        pagination = cachedPagination
    } = state;

    const ascending = pagination.order === "asc";
    const scrollHeight = (value) => {
        if (value !== undefined) {
            window.scrollTo(0, value);
            return;
            // ((containerRef && containerRef.current) || window).scrollTo(0, value);
        }
        if (containerRef && containerRef.current) return containerRef.current.scrollHeight;
        return window.screenHeight;
    }

    const loadNextPage = () => {
        if (finished) {
            return;
        }
        if (!disableProgress) dispatch(ProgressView.SHOW);

        let before = null;
        if (reverse) {
            before = scrollHeight();
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
                            return itemComponent(transformed, index, ItemProps);
                        } catch (error) {
                            console.error(error);
                        }
                    }
                });
                return Promise.all(newitems);
            })
            .then(newitems => pageTransform(newitems))
            .then(newitems => newitems.filter(item => item !== undefined))
            .then(newitems => {
                console.log(`[Lazy] loaded ${refresh ? 0 : items.length}+${newitems.length} items${cache ? " on " + cache : ""}`);
                return ascending
                    ? (reverse ? [...newitems.reverse(), ...(refresh ? [] : items)] : [...(refresh ? [] : items), ...newitems])
                    : (reverse ? [...newitems, ...(refresh ? [] : items)] : [...(refresh ? [] : items), ...newitems.reverse()])
            })
            .then(newitems => newitems.filter(item => {
                newitems._cmp = newitems._cmp || {};
                if (newitems._cmp[item.key]) return false;
                newitems._cmp[item.key] = true;
                return true;
            }))
            .then(items => ({
                ascending,
                finished: pagination.finished,
                random: Math.random(),
                items,
                loading: false,
                pagination,
                refresh: null,
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
                        type: lazyListComponentReducer.UPDATE,
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
                if (reverse) {
                    setTimeout(() => {
                        const after = scrollHeight();
                        scrollHeight(after - before);
                    }, 0)
                }
                if (!disableProgress) dispatch(ProgressView.HIDE);
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
            let transformed = await itemTransform(item, snapshot.key);
            if (transformed) {
                transformed = itemComponent(transformed, snapshot.key, ItemProps);
            }
            if (cache) {
                dispatch({
                    type: lazyListComponentReducer._ADD,
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
            if (cache) dispatch({type: lazyListComponentReducer.RESET, cache});
            else dispatch({type: lazyListComponentReducer.RESET});
        }

        if (live) {
            liveAddRef.on("child_added", liveAddListener);
            liveRemoveRef.on("child_removed", liveRemoveListener);
        }
        return () => {
            liveAddRef && liveAddRef.off("child_added", liveAddListener);
            liveRemoveRef && liveRemoveRef.off("child_removed", liveRemoveListener);
            if (!disableProgress) dispatch(ProgressView.HIDE);
            if (!cache) pagination.reset();
            isMounted = false;
        }
    }, [pagination.term, cachedPagination.term]);

    React.useEffect(() => {
        if (items.length) {
            console.log(`[Lazy] cached ${items.length} items${cache ? " on " + cache : ""}`);
        }
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
    }, [random, pagination.term, cachedPagination.term, reverse])

    React.useEffect(() => {
        if (!cache || !autoRefresh) return;
        if (history.action === "POP") {
            history.action = "PUSH";
            return;
        }
        console.log(`[Lazy] refresh ${cache}`);
        if (!reverse) scrollHeight(0);
        dispatch({type: lazyListComponentReducer.REFRESH, ...(cache ? {cache} : {})});
    }, [cache, autoRefresh, reverse]);

    React.useEffect(() => {
        if (!refresh) return;
        loadNextPage();
    }, [cache, refresh]);

    if (reverse === true && !containerRef) {
        console.warn("[Lazy] 'containerRef' must be defined due to 'reverse'=true")
    }

    return <>
        {reverse && <Observer
            finished={finished}
            active={!refresh}
            key={items.length}
            loadNextPage={loadNextPage}
            placeholder={placeholder}
            placeholders={placeholders}
        />}
        {items}
        {!reverse && <Observer
            active={!refresh}
            finished={finished}
            key={items.length}
            loadNextPage={loadNextPage}
            placeholder={placeholder}
            placeholders={placeholders}
        />}
        <Scroller live={live && !ascending && reverse} className={scrollerClassName}/>
        {finished && !items.length && noItemsComponent}
    </>
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

const mapStateToProps = ({lazyListComponentReducer}) => {
    return {...lazyListComponentReducer};
}

export default connect(mapStateToProps)(LazyListComponent)
