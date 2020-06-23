import React from "react";
import {notifySnackbar} from "../controllers";
import ProgressView from "./ProgressView";
import {connect, useDispatch} from "react-redux";
import {InView} from "react-intersection-observer";

const LazyListComponent = (props) => {
    const dispatch = useDispatch();
    const {
        cache = false,
        itemComponent,
        itemTransform,
        pagination: givenPagination,
        placeholder,
        placeholders = 1,
        disableProgress,
        noItemsComponent = null,
        ["LazyListComponent_" + cache]: cacheData = {}
    } = props;
    const [state, setState] = React.useState({});
    const {
        finished: cachedFinished = false,
        items: cachedItems = [],
        loading: cachedLoading = true,
        pagination: cachedPagination = givenPagination instanceof Function ? givenPagination() : givenPagination
    } = cacheData;
    const {
        finished = cache ? cachedFinished : false,
        items = cache ? cachedItems : [],
        loading = cache ? cachedLoading : true,
        pagination = cache ? cachedPagination : (givenPagination instanceof Function ? givenPagination() : givenPagination)
    } = state;
    const inViewRef = React.createRef();

    if(!placeholder) throw new Error("Placeholder is not defined");

    const loadNextPart = () => {
        if (finished) {
            return;
        }
        if (!disableProgress) dispatch(ProgressView.SHOW);
        return pagination.next()
            .then(async newitems => {
                newitems = newitems.map(async (item, index) => {
                    try {
                        const transformed = await itemTransform(item);
                        if(transformed) {
                            return itemComponent(transformed, index);
                        }
                    } catch (error) {
                        notifySnackbar(error);
                    }
                });
                return Promise.all(newitems);
            }).then(newitems => ({
                    finished: pagination.finished,
                    items: pagination.order === "asc" ? [...items, ...newitems] : [...items, ...newitems.reverse()],
                    loading: false,
                    pagination
                })
            ).catch(error => {
                notifySnackbar({
                    error: error,
                    buttonLabel: "Refresh",
                    onButtonClick: () => dispatch({type: LazyListComponent.RESET, cache}),
                });
                return {
                    finished: true,
                    items: [],
                    loading: false,
                    pagination
                }
            }).then(update => {
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
            }).finally(() => {
                if (!disableProgress) dispatch(ProgressView.HIDE);
            });
    };

    React.useEffect(() => {
        // loadNextPart();
        return () => {
            if (!disableProgress) dispatch(ProgressView.HIDE);
        }
        // eslint-disable-next-line
    }, []);

    if (items.length) console.log(`[Lazy] loaded ${items.length} items${cache ? " on " + cache : ""}`);
    return <React.Fragment>
        {items}
        {/*{items.map((item) => item && itemComponent(item))}*/}
        {!finished && <InView ref={inViewRef} style={{width: "100%"}} onChange={(inView) => {
            if (inView) loadNextPart();
        }}>
            {(() => {
                const a = [];
                for (let i = 0; i < placeholders; i++) {
                    a.push(i)
                }
                return a;
            })().map((item, index) => <placeholder.type {...placeholder.props} key={index}/>)}
        </InView>}
        {!items.length && finished && noItemsComponent}
    </React.Fragment>
}

export const lazyListComponent = (state = {}, action) => {
    const cache = action.cache;
    const cacheData = action["LazyListComponent_" + cache];
    switch (action.type) {
        case LazyListComponent.UPDATE:
            return {...state, ["LazyListComponent_" + cache]: cacheData};
        case LazyListComponent.RESET:
            const {pagination} = cacheData || state["LazyListComponent_" + cache] || {};
            if (pagination) pagination.reset();
            return {...state, ["LazyListComponent_" + cache]: {items: [], loading: true, finished: false}};
        case LazyListComponent.EXIT:
            return {...state, ["LazyListComponent_" + cache]: {}};
        default:
            return state;
    }
};
lazyListComponent.skipStore = true;

LazyListComponent.UPDATE = "LazyListComponent_update";
LazyListComponent.RESET = "LazyListComponent_reset";
LazyListComponent.EXIT = "LazyListComponent_exit";

const mapStateToProps = ({lazyListComponent, ...rest}) => {
    return {...lazyListComponent};
}

export default connect(mapStateToProps)(LazyListComponent);
