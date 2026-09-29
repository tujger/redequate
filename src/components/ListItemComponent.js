import MenuIcon from "@material-ui/icons/MoreVert";
import React from "react";
import {useDrag} from "react-use-gesture";
import {useWindowData} from "../controllers";
import notifySnackbar from "../controllers/notifySnackbar";
import Select from "../controls/Select/Select";
import SelectItem from "../controls/Select/SelectItem";
import useRippleEffect from "../helpers/useRippleEffect";
import cardStyles from "./PostComponent/styles/PostComponent.module.css";
import styles from "./styles/ListItemComponent.module.css";

export default (props) => {
    const {
        className = "",
        children,
        disabled = false,
        leftAction = undefined,
        menu = undefined,
        rightAction = undefined,
        onClickCapture = undefined,
        onContextMenu = undefined,
        onMenuSelect = undefined,
        onKeyDown = undefined
    } = props;
    const onPointerDown = useRippleEffect();
    const windowData = useWindowData();
    const isNarrow = windowData.isNarrow();

    const [state, setState] = React.useState({});
    const {x, dragging, removing, ref, removed, random} = state;

    const actionIndent = calculateActionIndent();

    const bind = useDrag(async evt => {
        const {down, movement: [mx]} = evt;
        if (down && Math.abs(mx) < 10) return;
        let x = mx;
        let removing = false;
        try {
            if (!down) {
                if (leftAction && mx > actionIndent) {
                    removing = await leftAction.action(evt);
                } else if (rightAction && mx < -actionIndent) {
                    removing = await rightAction.action(evt);
                }
                x = 0;
            } else {
                if (mx > 0 && !leftAction) x = 0;
                else if (mx < 0 && !rightAction) x = 0;
            }
        } catch (e) {
            console.error(e);
            notifySnackbar({title: e.message, variant: "error"});
            x = 0;
        }
        if (ref && ref.current) {
            setState({...state, dragging: down, x: x, removing})
        }
    });
    const bind_ = isNarrow && (process.env.NODE_ENV === "development") ? bind : () => {
    };

    React.useEffect(() => {
        const ref = React.createRef();
        setState({...state, ref});
    }, []);

    if (removing) {
        const sizes = ref.current.getBoundingClientRect();
        ref.current.style.height = sizes.height + "px";
        ref.current.style.overflowY = "hidden";
        setTimeout(() => {
            try {
                ref.current.style.height = "0";
                setTimeout(() => {
                    setState({...state, removing: false, removed: true});
                }, 200);
            } catch (e) {
                console.error(e);
            }
        }, 50);
    }

    if (removed) return null;
    return <div
        className={styles.root} ref={ref} key={random}
        onKeyDown={onKeyDown}
        onPointerDown={disabled ? undefined : onPointerDown}
        tabIndex={disabled ? -1 : 0}
    >
        {isNarrow && leftAction && leftAction.itemButton({
            className: [styles.leftAction, styles.leftActionButton].join(" "),
            selected: x > actionIndent,
            style: {right: "auto", opacity: (x || 0) / actionIndent}
        })}
        {isNarrow && rightAction && rightAction.itemButton({
            className: [styles.rightAction, styles.rightActionButton].join(" "),
            selected: x < -actionIndent,
            style: {left: "auto", opacity: -(x || 0) / actionIndent}
        })}
        <div
            {...bind_()}
            onContextMenu={onContextMenu ? evt => {
                onContextMenu(evt);
                setState({...state, random: Math.random()})
            } : null}
            onClickCapture={onClickCapture || (event => {
                if (dragging) {
                    event.stopPropagation();
                    event.preventDefault();
                    if (x === 0) {
                        setState({...state, dragging: false, x: 0});
                    }
                }
            })}
            className={[styles.content, className].filter(Boolean).join(" ")}
            style={{left: x}}
        >
            {children}
            {!isNarrow && menu && <Select
                className={cardStyles.cardMenuButton}
                displayEmpty
                iconMenu
                IconComponent={() => null}
                onChange={onContextMenu}
                onClick={event => {
                    event.stopPropagation();
                }}
                renderValue={() => <MenuIcon/>}
                value={""}
            >
                {menu.map((item, index) => <SelectItem
                    children={item.label}
                    key={index}
                    onClick={event => {
                        event.stopPropagation();
                        onMenuSelect?.(event, item);
                    }}
                    // onClick={handleSelectItemClick}
                    value={item.value}
                />)}
            </Select>}
        </div>
    </div>
}

const calculateActionIndent = () => {
    let indent;
    indent = window.innerWidth / 5;
    if (indent > 100) indent = 100;
    return indent;
}
