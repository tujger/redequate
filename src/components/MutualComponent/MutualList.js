import React from "react";
import {useDispatch} from "react-redux";
import Grid from "@material-ui/core/Grid";
import MutualRequestItem from "./MutualRequestItem";
import MutualSubscribeItem from "./MutualSubscribeItem";
import {MutualListMode} from "./MutualConstants";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {cacheDatas, useFirebase} from "../../controllers/General";
import {lazyListComponentReducer} from "../LazyListComponent/lazyListComponentReducer";
import Pagination from "../../controllers/FirebasePagination";
import {UserData} from "../../controllers/UserData";
import LazyListComponent from "../LazyListComponent/LazyListComponent";

const MutualListComponent = (
    {
        cached = true,
        itemComponent,
        itemTransform,
        mode = MutualListMode.SUBSCRIBES,
        mutualId,
        noItemsComponent = <ItemPlaceholderComponent label={"Items not found."}/>,
        onChanged = () => {
        },
        order = "desc",
        pageTransform = items => items,
        placeholder = <ItemPlaceholderComponent skeleton={true}/>,
        typeId,
        unsubscribeLabel,
    }) => {
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const mixedId = typeId + "_" + mode + "_" + mutualId;

    const refreshList = () => {
        console.log(`[MutualList] reset list ${mixedId}`);
        dispatch({type: lazyListComponentReducer.REFRESH, ...(cached ? {cache: mixedId} : {})});
    }

    const fetchPagination = () => {
        if (mode === MutualListMode.SUBSCRIBERS) {
            return () => new Pagination({
                ref: firebase.database().ref("mutual").child(typeId),
                child: "id",
                equals: mutualId,
                order,
            })
        } else if (mode === MutualListMode.SELF) {
            return () => new Pagination({
                ref: firebase.database().ref(typeId),
                child: "uid",
                equals: mutualId,
                order,
            })
        } else if (mode === MutualListMode.SUBSCRIBES) {
            return () => new Pagination({
                ref: firebase.database().ref("mutual").child(typeId),
                child: "uid",
                equals: mutualId,
                order,
            })
        } else if (mode === MutualListMode.STAMPS) {
            return () => new Pagination({
                ref: firebase.database().ref("mutualstamps").child(typeId).child(mutualId),
                order,
            });
        } else if (mode === MutualListMode.REQUESTS) {
            return () => new Pagination({
                ref: firebase.database().ref("mutualrequests").child(typeId),
                child: "id",
                equals: mutualId,
                order,
            });
        }
    }

    const fetchItemComponent = () => {
        if (itemComponent) return itemComponent;
        if (mode === MutualListMode.REQUESTS) {
            return item => <MutualRequestItem
                data={item}
                key={item.key}
                onDelete={() => {
                    refreshList();
                    onChanged();
                }}
            />
        } else if (mode === MutualListMode.SUBSCRIBERS || mode === MutualListMode.SUBSCRIBES) {
            return item => <MutualSubscribeItem
                data={item}
                key={item.key}
                onDelete={() => {
                    refreshList();
                    onChanged();
                }}
                unsubscribeLabel={unsubscribeLabel}
            />
        } else if (mode === MutualListMode.STAMPS) {
            throw Error("'itemComponent' is not defined")
        }
        return item => <Grid
            children={JSON.stringify(item, null, " ")}
            container key={item.key}
            style={{whiteSpace: "pre-wrap", marginBottom: "16px", borderBottom: "solid lightgray 1px"}}/>
    }

    const fetchItemTransform = () => {
        if (itemTransform) return itemTransform;
        if (mode === MutualListMode.REQUESTS) {
            return item => {
                return cacheDatas.put(item.value.uid, UserData(firebase))
                    .fetch(item.value.uid, [UserData.NAME, UserData.IMAGE])
                    .then(userData => ({...item, key: `${typeId}/${item.key}`, userData}));
            }
        } else if (mode === MutualListMode.SUBSCRIBERS) {
            return item => {
                return cacheDatas.put(item.value.uid, UserData(firebase))
                    .fetch(item.value.uid, [UserData.NAME, UserData.IMAGE])
                    .then(userData => ({...item, key: `${typeId}/${item.key}`, userData}));
            }
        } else if (mode === MutualListMode.SUBSCRIBES) {
            return item => {
                return cacheDatas.put(item.value.id, UserData(firebase))
                    .fetch(item.value.id, [UserData.NAME, UserData.IMAGE])
                    .then(userData => ({...item, key: `${typeId}/${item.key}`, userData}));
            }
        } else if (mode === MutualListMode.STAMPS) {
            throw Error("'itemTransform' is not defined")
        }
        return item => item
    }

    return <LazyListComponent
        cache={cached ? mixedId : undefined}
        itemComponent={fetchItemComponent()}
        itemTransform={fetchItemTransform()}
        noItemsComponent={noItemsComponent}
        pageTransform={pageTransform}
        pagination={fetchPagination()}
        placeholder={placeholder}
    />
}

export default MutualListComponent;
