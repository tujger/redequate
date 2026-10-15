import React from "react";
import {useDispatch} from "react-redux";
import notifySnackbar from "../../controllers/notifySnackbar";
import ListItemComponent from "../ListItemComponent";
import ProgressView from "../ProgressView";
import Observer from "./Observer";

export default (
    {
        disableProgress,
        itemTransform = async item => ({children: JSON.stringify(item)}),
        ItemComponent = ListItemComponent,
        noItemsComponent,
        cursor,
        page = 10,
        placeholder,
    }) => {
    const dispatch = useDispatch();
    const [state, setState] = React.useState({});
    const session = React.useRef();
    const {finished = false, items = []} = state.cursor === cursor ? state : {};

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
            if (session.current !== current) {
                return;
            }
            const newitems = await Promise.all(entries.map(async item => {
                try {
                    const itemProps = await itemTransform(item);
                    return <ItemComponent key={item.key} {...itemProps}/>;
                } catch (error) {
                    if (session.current === current) {
                        console.error(error);
                    }
                }
            }));
            if (session.current !== current) {
                return;
            }
            const finished = cursor.position.finished;
            console.log(`[Lazy] loaded ${items.length}+${newitems.filter(Boolean).length} items`);
            setState(previous => {
                if (session.current !== current) {
                    return previous;
                }
                const items = previous.cursor === cursor ? previous.items : [];
                const seen = new Set();
                return {
                    cursor,
                    finished,
                    items: [...items, ...newitems].filter(item => {
                        if (!item || seen.has(item.key)) {
                            return false;
                        }
                        seen.add(item.key);
                        return true;
                    })
                };
            });
        } catch (error) {
            if (session.current !== current) {
                return;
            }
            notifySnackbar({
                buttonLabel: "Refresh",
                error,
                onButtonClick: () => window.location.reload(),
            });
            setState(previous => session.current === current
                ? {finished: true, items: [], cursor} : previous);
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
        cursor?.reset?.();
        session.current = current;
        setState({finished: false, items: [], cursor});
        return () => {
            if (session.current === current) {
                session.current = undefined;
            }
            if (current.progress) {
                current.progress = false;
                dispatch(ProgressView.HIDE);
            }
        };
    }, [cursor]);

    return <>
        {items}
        <Observer
            finished={finished}
            key={`${cursor.identifier}:${items.length}`}
            loadNextPage={loadNextPage}
            placeholder={placeholder}
        />
        {finished && !items.length && noItemsComponent}
    </>
}
