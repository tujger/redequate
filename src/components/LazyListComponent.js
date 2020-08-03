import React from "react";
import {notifySnackbar} from "../controllers/Notifications";
import {useWindowData} from "../controllers/General";
import ProgressView from "./ProgressView";
import {connect, useDispatch} from "react-redux";
import {InView} from "react-intersection-observer";
import PropTypes from "prop-types";

const LazyListComponent =
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
         pagination: givenPagination,
         placeholder,
         placeholders = 1,
         random,
         reverse = false,
         ["LazyListComponent_" + cache]: cacheData = {},
         ...props
     }) => {
        const dispatch = useDispatch();
        const [state, setState] = React.useState({});
        const {
            finished: cachedFinished = false,
            items: cachedItems = [],
            loading: cachedLoading = true,
            pagination: cachedPagination = givenPagination instanceof Function ? givenPagination() : givenPagination
        } = cacheData;
        const {
            finished = cache !== undefined ? cachedFinished : false,
            items = cache !== undefined ? cachedItems : [],
            loading = cache !== undefined ? cachedLoading : true,
            pagination = cache !== undefined ? cachedPagination : (givenPagination instanceof Function ? givenPagination() : givenPagination)
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
                .then(newitems => ({
                        ascending,
                        finished: pagination.finished,
                        items: ascending
                            ? (reverse ? [...newitems.reverse(), ...items] : [...items, ...newitems])
                            : (reverse ? [...newitems, ...items] : [...items, ...newitems.reverse()]),
                        loading: false,
                        pagination,
                        reverse
                    })
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
                if(!isMounted) return;
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
                if(!isMounted) return;
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
            }
            // eslint-disable-next-line
        }, [pagination, givenPagination.term]);

        React.useEffect(() => {
            if (cache) return;
            // pagination && pagination.reset();
            setState(state => ({
                ...state,
                items: [],
                loading: true,
                finished: false,
                pagination: (givenPagination instanceof Function ? givenPagination() : givenPagination)
            }));
        }, [random, givenPagination.term])

        if (reverse === true && !containerRef) {
            throw new Error("[Lazy] 'containerRef' must be defined due to reverse=true")
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
;

const Scroller = ({live, placeholder}) => {
    const windowData = useWindowData();
    const [scrolled, setScrolled] = React.useState(false);

    const scrollerShown = React.useRef();
    const taskRef = React.useRef();
    if (!live) return null;

    React.useEffect(() => {
        let isMounted = true;
        const handleScroll = (evt) => {
            if (!scrollerShown.current) {
                isMounted && setScrolled(true);
            }
        };
        window.addEventListener("touchmove", handleScroll, true)
        window.addEventListener("wheel", handleScroll, true)
        return () => {
            window.removeEventListener("touchmove", handleScroll);
            window.removeEventListener("wheel", handleScroll);
            isMounted = false;
        }
    }, [])

    return <InView
        onChange={(inView) => {
            scrollerShown.current = inView;
            if (inView) {
                setScrolled(false);
            }
        }}
        ref={ref => {
            clearTimeout(taskRef.current);
            if (ref && !scrolled) {
                taskRef.current = setTimeout(() => {
                    if (!ref.node) return;
                    if (ref.node.scrollIntoViewIfNeeded) ref.node.scrollIntoViewIfNeeded(false);
                    else ref.node.scrollIntoView({block: "end", inline: "nearest", behavior: "smooth"});
                }, 500);
            }
        }} style={{opacity: 0}}>
        {windowData.isNarrow() ? placeholder : null}
    </InView>
}

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

export const lazyListComponentReducer = (state = {}, action) => {
    const cache = action.cache;
    const cacheData = action["LazyListComponent_" + cache];
    switch (action.type) {
        case LazyListComponent._ADD:
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
lazyListComponentReducer.skipStore = true;

const mapStateToProps = ({lazyListComponentReducer}) => {
    return {...lazyListComponentReducer};
}

export default connect(mapStateToProps)(LazyListComponent)
