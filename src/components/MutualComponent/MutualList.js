import React from "react";
// eslint-disable-line no-unused-vars -- Required by the classic JSX build.
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {DatabaseOrder} from "../../../packages/database/src";
import {useDatabase} from "../../controllers";
import {cacheDatas, Layout} from "../../controllers/General";
import UserData from "../../controllers/UserData";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import LazyListComponent from "../LazyListComponent/LazyListComponent";
import {MutualListMode} from "./MutualConstants";
import MutualRequestItem from "./MutualRequestItem";
import MutualSubscribeItem from "./MutualSubscribeItem";
import styles from "./styles/MutualList.module.css";

export default props => {
    const {t} = useTranslation();
    const {
        itemComponent,
        itemTransform,
        live,
        mode = MutualListMode.SUBSCRIBES,
        mutualId,
        noItemsComponent = <ItemPlaceholderComponent label={t("Mutual.Items not found.")} pattern={"flat"}/>,
        onChanged = () => {
        },
        order = DatabaseOrder.DESC,
        pattern,
        placeholder = <ItemPlaceholderComponent skeleton={true} pattern={"flat"}/>,
        typeId,
        unsubscribeLabel,
        ItemProps,
    } = props;
    const database = useDatabase();
    const dispatch = useDispatch();
    const mixedId = typeId + "_" + mode + "_" + mutualId;

    const refreshList = () => {
        console.log(`[MutualList] reset list ${mixedId}`);
        dispatch({type: Layout.REFRESH});
    }

    let cursor;
    if (typeId && mutualId) {
        if (mode === MutualListMode.SUBSCRIBERS) {
            cursor = database.cursor(["mutual", {mutual_type: typeId}, "mutual_id"], {
                equalTo: mutualId,
                order,
                orderBy: ["id"],
            })
        } else if (mode === MutualListMode.SELF) {
            cursor = database.cursor(["mutualstamps", {mutual_type: "_my"}, {user_id: mutualId}, "mutual_id"], {
                order,
            })
        } else if (mode === MutualListMode.SUBSCRIBES) {
            cursor = database.cursor(["mutual", {mutual_type: typeId}, "mutual_id"], {
                equalTo: mutualId,
                order,
                orderBy: ["uid"],
            })
        } else if (mode === MutualListMode.STAMPS) {
            cursor = database.cursor(["mutualstamps", {mutual_type: typeId}, {user_id: mutualId}, "mutual_id"], {
                order,
            })
        } else if (mode === MutualListMode.REQUESTS) {
            cursor = database.cursor(["mutualrequests", {mutual_type: typeId}, "mutual_id"], {
                equalTo: mutualId,
                order,
                orderBy: ["id"]
            })
        }
    }

    const fetchItemComponent = () => {
        if (itemComponent) return itemComponent;
        if (mode === MutualListMode.REQUESTS) {
            return item => <MutualRequestItem
                {...ItemProps}
                data={item}
                key={item.key + "_" + mixedId}
                onDelete={() => {
                    refreshList();
                    onChanged();
                }}
                pattern={pattern}
            />
        } else if (mode === MutualListMode.SUBSCRIBERS || mode === MutualListMode.SUBSCRIBES) {
            return item => <MutualSubscribeItem
                {...ItemProps}
                data={item}
                key={item.key + "_" + mixedId}
                onDelete={() => {
                    refreshList();
                    onChanged();
                }}
                pattern={pattern}
                type={item.value.type}
                typeId={typeId}
                unsubscribeLabel={unsubscribeLabel}
            />
        } else if (mode === MutualListMode.STAMPS) {
            throw Error("'itemComponent' is not defined")
        }
        return item => <div
            {...ItemProps}
            className={[styles.fallbackItem, ItemProps?.className].filter(Boolean).join(" ")}
            key={item.key + "_" + mixedId}
            style={undefined}
        >{JSON.stringify(item, null, " ")}</div>
    }

    const fetchItemTransform = () => {
        if (itemTransform) return itemTransform;
        if (mode === MutualListMode.REQUESTS) {
            return item => {
                return cacheDatas.put(item.value.uid, new UserData(database))
                    .fetch(item.value.uid, [UserData.NAME, UserData.IMAGE])
                    .then(userData => ({...item, userData}));
            }
        } else if (mode === MutualListMode.SUBSCRIBERS) {
            return item => {
                return cacheDatas.put(item.value.uid, new UserData(database))
                    .fetch(item.value.uid, [UserData.NAME, UserData.IMAGE])
                    .then(userData => ({...item, userData}));
            }
        } else if (mode === MutualListMode.SUBSCRIBES) {
            return item => {
                return cacheDatas.put(item.value.id, new UserData(database))
                    .fetch(item.value.id, [UserData.NAME, UserData.IMAGE])
                    .then(userData => ({...item, userData}));
            }
        } else if (mode === MutualListMode.STAMPS) {
            throw Error("'itemTransform' is not defined")
        }
        return item => item
    }

    if (!typeId || !mutualId) {
        console.error(Error(`Some of arguments are not defined: typeId=${typeId}, mutualId=${mutualId}`));
        return noItemsComponent;
    }

    return <LazyListComponent
        cursor={cursor}
        ItemComponent={fetchItemComponent()}
        itemTransform={fetchItemTransform()}
        live={live}
        noItemsComponent={noItemsComponent}
        placeholder={placeholder}
    />
}
