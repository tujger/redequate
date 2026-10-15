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
    const {finished = false, items = []} = state.cursor === cursor ? state : {};

    const loadNextPage = () => {
        if (finished) {
            return;
        }
        if (!disableProgress) dispatch(ProgressView.SHOW);

        return cursor.next(page)
            .then(async newitems => {
                newitems = newitems.map(async (item, index) => {
                    try {
                        const itemProps = await itemTransform(item);
                        return <ItemComponent key={item.key} {...itemProps}/>;
                    } catch (error) {
                        console.error(error);
                    }
                });
                return Promise.all(newitems);
            })
            .then(newitems => newitems.filter(item => item !== undefined))
            .then(newitems => {
                console.log(`[Lazy] loaded ${items.length}+${newitems.length} items`);
                return [...items, ...newitems];
            })
            .then(newitems => newitems.filter(item => {
                newitems._cmp = newitems._cmp || {};
                if (newitems._cmp[item.key]) return false;
                newitems._cmp[item.key] = true;
                return true;
            }))
            .then(items => ({
                finished: cursor.position.finished,
                items,
                cursor,
            }))
            .catch(error => {
                notifySnackbar({
                    buttonLabel: "Refresh",
                    error: error,
                    onButtonClick: () => {
                        window.location.reload()
                    },
                });
                return {
                    finished: true,
                    items: [],
                    cursor,
                }
            })
            .then(update => setState(update))
            .finally(() => {
                if (!disableProgress) dispatch(ProgressView.HIDE);
            });
    };

    React.useEffect(() => {
        cursor.reset();
        setState({finished: false, items: [], cursor});
        return () => {
            if (!disableProgress) {
                dispatch(ProgressView.HIDE);
            }
            cursor.reset();
        };
    }, [cursor]);

    return <>
        {items}
        <Observer
            finished={finished}
            key={`${cursor.identifier}:${items.length}`}
            loadNextPage={loadNextPage}
            placeholder={placeholder}
            placeholders={1}
        />
        {finished && !items.length && noItemsComponent}
    </>
}
