import React from 'react';
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
        ["_LazyListComponent_" + cache]:cacheData = {}
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
        dispatch(ProgressView.SHOW);
        return pagination.next().then(newitems => {
            newitems = newitems.map(item => itemTransform({...item, id: item._key}));
            const update = {
                finished: pagination.finished,
                items: [...items, ...newitems.reverse()],
                loading: false,
                pagination
            }
            if(cache) {
                dispatch({
                    type: LazyListComponent.UPDATE,
                    cacheId: cache,
                    ["_LazyListComponent_" + cache]: update});
            } else {
                setState(state => ({
                    ...state,
                    ...update,
                }))
            }
        }).catch(notifySnackbar).finally(() => {
            dispatch(ProgressView.HIDE);
        });
    };

    React.useEffect(() => {
        return () => {
            dispatch(ProgressView.HIDE);
        }
        // eslint-disable-next-line
    }, []);

    console.log(`[Lazy] loaded ${items.length} items`);
    return <React.Fragment>
        {loading ?
            <LoadingComponent/> :
            items.map((item) => itemComponent(item))
        }
        {!finished ? <InView onChange={(inView) => {
            if (inView) loadNextPart();
        }}>
            <div/>
        </InView> : null}
        {!finished && items.length > 0 ?
            <React.Fragment>
                {(() => {
                    const a = [];for (let i = 0; i < 3; i++) {a.push(i)} return a;
                })().map((item, index) => <placeholder.type {...placeholder.props} key={index}/>)}
            </React.Fragment>
            : null}
    </React.Fragment>
}

export const lazyListComponent = (state = {}, action) => {
    const cacheId = action.cacheId;
    const cacheData = action["_LazyListComponent_" + cacheId];
    switch (action.type) {
        case LazyListComponent.UPDATE:
            return {...state, ["_LazyListComponent_" + cacheId]: cacheData};
        case LazyListComponent.RESET:
            console.log("pagination", state.pagination);
            return {...state, ["_LazyListComponent_" + cacheId]: {items:[], loading:true, finished:false}};
        case LazyListComponent.EXIT:
            return state;
            return {...state, scroll: action.scroll};
        default:
            return state;
    }
};
lazyListComponent.skipStore = true;

LazyListComponent.UPDATE = "_LazyListComponent_update";
LazyListComponent.RESET = "_LazyListComponent_reset";
LazyListComponent.EXIT = "_LazyListComponent_exit";

const mapStateToProps = ({lazyListComponent, ...rest}) => {
    return {...lazyListComponent};
}

export default connect(mapStateToProps)(LazyListComponent);
