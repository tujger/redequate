import React from "react";
import {notifySnackbar} from "../../controllers/Notifications";
import ProgressView from "../ProgressView";
import {connect, useDispatch} from "react-redux";
import PropTypes from "prop-types";
import {Observer} from "./Observer";
import {Scroller} from "./Scroller";

function LazyListComponent
({
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
     ...props
 }) {
    const dispatch = useDispatch();
    const [state, setState] = React.useState({});
    const givenPagination = sourcePagination instanceof Function ? sourcePagination() : sourcePagination;
    const {
        finished: cachedFinished = false,
        items: cachedItems = [],
        loading: cachedLoading = true,
        pagination: cachedPagination = givenPagination
    } = cacheData;
    const {
        finished = cache !== undefined ? cachedFinished : false,
        items = cache !== undefined ? cachedItems : [],
        loading = cache !== undefined ? cachedLoading : true,
        pagination = cache !== undefined ? cachedPagination : givenPagination
    } = state;

    const ascending = pagination.order === "asc";

    const loadNextPart = () => {
        if (finished) {
            return;
        }
        if (!disableProgress) dispatch(ProgressView.SHOW);

        let before = null;
        if (reverse && containerRef && containerRef.current) {
            before = containerRef.current.scrollHeight;
        }

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
                    }
                });
                return Promise.all(newitems);
            })
            .then(newitems => pageTransform(newitems))
            .then(newitems => newitems.filter(item => item !== undefined))
            .then(newitems => {
                return ({
                        ascending,
                        finished: pagination.finished,
                        items: ascending
                            ? (reverse ? [...newitems.reverse(), ...items] : [...items, ...newitems])
                            : (reverse ? [...newitems, ...items] : [...items, ...newitems.reverse()]),
                        loading: false,
                        pagination,
                        reverse
                    })
                }
            )
            .catch(error => {
                notifySnackbar({
                    buttonLabel: "Refresh",
                    error: error,
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
            if (!lastKey && !givenPagination.finished) {
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
                    type: LazyListComponent._ADD,
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
            if (cache) dispatch({type: LazyListComponent.RESET, cache});
            else dispatch({type: LazyListComponent.RESET});
        }

        if (live) {
            liveAddRef.on("child_added", liveAddListener);
            liveRemoveRef.on("child_removed", liveRemoveListener);
        }
        return () => {
            isMounted = false;
            liveAddRef && liveAddRef.off("child_added", liveAddListener);
            liveRemoveRef && liveRemoveRef.off("child_removed", liveRemoveListener);
            if (!disableProgress) dispatch(ProgressView.HIDE);
            if (!cache) pagination.reset();
        }
    }, [pagination.term, givenPagination.term]);

    React.useEffect(() => {
        if (cache) return;
        givenPagination.reset();
        const update = {
            finished: false,
            items: [],
            loading: true,
            pagination: givenPagination,
            reverse
        }
        setState(state => ({
            ...state,
            ...update,
        }))
    }, [random, pagination.term, givenPagination.term])

    if (reverse === true && !containerRef) {
        throw new Error("[Lazy] 'containerRef' must be defined due to 'reverse'=true")
    }
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
        <Scroller live={live && !ascending && reverse} placeholder={placeholder}/>
        {!items.length && finished && noItemsComponent}
    </React.Fragment>
}

LazyListComponent._ADD = "LazyListComponent_add";
LazyListComponent.EXIT = "LazyListComponent_exit";
LazyListComponent.RESET = "LazyListComponent_reset";
LazyListComponent.UPDATE = "LazyListComponent_update";

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
