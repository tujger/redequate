import React from "react";
import {useDispatch} from "react-redux";
import {DatabaseOrder} from "../../../packages/database/src";
import notifySnackbar from "../../controllers/notifySnackbar";
import ListItemComponent from "../ListItemComponent";
import ProgressView from "../ProgressView";
import Observer from "./Observer";

const itemTransformDefault = async item => ({children: JSON.stringify(item)});

export default (
    {
        disableProgress,
        itemTransform = itemTransformDefault,
        ItemComponent = ListItemComponent,
        live = false,
        noItemsComponent,
        cursor,
        page = 10,
        placeholder,
    }) => {
    const dispatch = useDispatch();
    const [items, setItems] = React.useState([]);
    const session = React.useRef();

    const renderItem = async (current, item) => {
        try {
            const itemProps = await itemTransform(item);
            if(!itemProps) return null;
            return <ItemComponent {...itemProps} id={item.id ?? item.key} key={item.key}/>;
        } catch (error) {
            if (session.current === current) {
                console.error(error);
            }
        }
    };

    const add = async (current, entries, prepend = false) => {
        const newitems = await Promise.all(entries.map(item => renderItem(current, item)));
        if (session.current !== current) {
            return [];
        }
        setItems(items => {
            if (session.current !== current) {
                return items;
            }
            const seen = new Set(items.map(item => item.key));
            const added = newitems.filter(item => {
                if (!item || seen.has(item.key)) {
                    return false;
                }
                seen.add(item.key);
                return true;
            });
            return prepend ? [...added, ...items] : [...items, ...added];
        });
        return newitems;
    };

    const remove = (current, entry) => {
        setItems(items => session.current === current
            ? items.filter(item => item.key !== String(entry.key)) : items);
    };

    const change = async (current, entry) => {
        const item = await renderItem(current, entry);
        if (!item) {
            return;
        }
        setItems(items => session.current === current
            ? items.map(previous => previous.key === item.key ? item : previous) : items);
    };

    const loadNextPage = async () => {
        const current = session.current;
        if (!current || current.cursor !== cursor || current.loading || cursor.position?.finished) {
            return;
        }
        current.loading = true;
        current.progress = !disableProgress;
        if (current.progress) {
            dispatch(ProgressView.SHOW);
        }

        try {
            const entries = await cursor.next(page);
            if (session.current !== current || entries === undefined) {
                return;
            }
            const newitems = await add(current, entries);
            if (session.current !== current) {
                return;
            }
            console.log(`[Lazy] loaded ${items.length}+${newitems.filter(Boolean).length} items`);
        } catch (error) {
            if (session.current !== current) {
                return;
            }
            notifySnackbar({
                buttonLabel: "Refresh",
                error,
                onButtonClick: () => window.location.reload(),
            });
            setItems(previous => session.current === current ? [] : previous);
        } finally {
            current.loading = false;
            if (session.current === current && current.progress) {
                current.progress = false;
                dispatch(ProgressView.HIDE);
            }
        }
    };

    React.useEffect(() => {
        const current = {cursor, loading: false, progress: false};
        session.current = current;
        return () => {
            setItems([]);
            if (session.current === current) {
                session.current = undefined;
            }
            if (current.progress) {
                current.progress = false;
                dispatch(ProgressView.HIDE);
            }
        };
    }, [cursor]);

    React.useEffect(() => {
        if (!live) return;
        const current = session.current;
        const handle = async (...args) => {
            const [{type, entry}] = args;
            if (type === "add") {
                const prepend = cursor.order === DatabaseOrder.DESC;
                if (prepend || cursor.position.finished) {
                    return add(current, [entry], prepend);
                }
            } else if (type === "change") {
                return change(current, entry);
            } else if (type === "remove") {
                return remove(current, entry);
            }
        }
        const subscribed = cursor.subscribe(handle);
        return () => {
            subscribed.unsubscribe();
        }
    }, [cursor, live, itemTransform, ItemComponent]);

    return <>
        {items}
        <Observer
            finished={cursor.position.finished}
            key={`${cursor.id}:${items.length}`}
            loadNextPage={loadNextPage}
            placeholder={placeholder}
        />
        {cursor.position.finished && !items.length && noItemsComponent}
    </>
}
