import React from "react";
import LoadingComponent from "./LoadingComponent";
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
        pagination:givenPagination,
        placeholder,
        disableProgress,
        ["LazyListComponent_" + cache]:cacheData = {}
    } = props;
    const [state, setState] = React.useState({});
    const {
        finished:cachedFinished = false,
        items:cachedItems = [],
        loading:cachedLoading = true,
        pagination:cachedPagination = givenPagination()
    } = cacheData;
    const {
        finished = cache ? cachedFinished : false,
        items = cache ? cachedItems : [],
        loading = cache ? cachedLoading : true,
        pagination = cache ? cachedPagination : givenPagination()
    } = state;

    const loadNextPart = () => {
        if (finished) {
            return;
        }
        if(!disableProgress) dispatch(ProgressView.SHOW);
        return pagination.next().then(async newitems => {
            newitems = newitems.map(async item => {
                try {
                    const component = await itemTransform({...item, id: item._key});
                    return itemComponent(component);
                } catch(error) {
                    notifySnackbar(error);
                }
            });
            return Promise.all(newitems);
        }).then(newitems => {
            const update = {
                finished: pagination.finished,
                items: pagination.order === "asc" ? [...items, ...newitems] : [...items, ...newitems.reverse()],
                loading: false,
                pagination
            }
            if(cache) {
                dispatch({
                    type: LazyListComponent.UPDATE,
                    cacheId: cache,
                    ["LazyListComponent_" + cache]: update});
            } else {
                setState(state => ({
                    ...state,
                    ...update,
                }))
            }
        }).catch(notifySnackbar).finally(() => {
            if(!disableProgress) dispatch(ProgressView.HIDE);
        });
    };

    React.useEffect(() => {
        // loadNextPart();
        return () => {
            if(!disableProgress) dispatch(ProgressView.HIDE);
        }
        // eslint-disable-next-line
    }, []);

    if(items.length) console.log(`[Lazy] loaded ${items.length} items`);
    // console.warn(loading, finished, items.length, cachedItems.length);
    return <React.Fragment>
        {items}
        {/*{items.map((item) => item && itemComponent(item))}*/}
        {!finished && <InView style={{width:"100%"}} onChange={(inView) => {
            if (inView) loadNextPart();
        }}>
            <placeholder.type {...placeholder.props} key={"LazyListComponent__placeholder"}/>
            {/*<React.Fragment>
                {(() => {
                    const a = [];for (let i = 0; i < 1; i++) {a.push(i)} return a;
                })().map((item, index) => <placeholder.type {...placeholder.props} key={index}/>)}
            </React.Fragment>*/}
        </InView>}
    </React.Fragment>
}

export const lazyListComponent = (state = {}, action) => {
    const cacheId = action.cacheId;
    const cacheData = action["LazyListComponent_" + cacheId];
    switch (action.type) {
        case LazyListComponent.UPDATE:
            return {...state, ["LazyListComponent_" + cacheId]: cacheData};
        case LazyListComponent.RESET:
            const {pagination} = cacheData || state["LazyListComponent_" + cacheId] || {};
            if(pagination) pagination.reset();
            return {...state, ["LazyListComponent_" + cacheId]: {items:[], loading:true, finished:false}};
        case LazyListComponent.EXIT:
            return state;
            return {...state, scroll: action.scroll};
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
