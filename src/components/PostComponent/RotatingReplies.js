import React from "react";
import Grid from "@material-ui/core/Grid";
import {cacheDatas, useFirebase, usePages} from "../../controllers/General";
import {UserData} from "../../controllers/UserData";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import withStyles from "@material-ui/styles/withStyles";
import {notifySnackbar} from "../../controllers";
import MentionedTextComponent from "../MentionedTextComponent";
import {lazyListComponentReducer} from "../LazyListComponent/lazyListComponentReducer";
import {useHistory} from "react-router-dom";
import {useDispatch} from "react-redux";

const stylesCurrent = theme => ({
    entering: {},
    leaving: {},
    root: {
        height: theme.spacing(4),
        marginBottom: theme.spacing(1.5),
        marginTop: theme.spacing(-1.5),
        paddingTop: theme.spacing(1),
        overflow: "hidden",
    },
    moveable: {
        height: theme.spacing(4),
        maxHeight: theme.spacing(4),
        overflow: "hidden",
        paddingLeft: theme.spacing(2),
        transition: "1s ease margin-top",
        "&$leaving": {
            marginTop: theme.spacing(-4),
        }
    },
    singleline: {
        "& br": {
            display: "none",
        },
        "& .MuiCardHeader-content": {
            overflow: "hidden",
            textOverflow: "ellipsis",
        },
        "& $textSmall": {
            display: "inline",
            whiteSpace: "nowrap",
        }
    },
    textSmall: {},
});

export default withStyles(stylesCurrent)((props) => {
    const {classes = {}, items, mentions, postId} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {item, itemPrev} = state;
    const taskRef = React.useRef(null);
    const leavingRef = React.useRef(null);
    const rootRef = React.useRef(null);

    const handleClick = () => {
        dispatch({type: lazyListComponentReducer.REFRESH});
        history.push(pages.post.route + postId, {
            onlyReplies: true,
        })
    }

    React.useEffect(() => {
        let isMounted = true;
        let selectedIndex = -1;

        const prepareRotating = async () => {
            return {selectedIndex};
        }
        const checkIfAppInForeground = async props => {
            let hidden;
            if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
                hidden = "hidden";
            } else if (typeof document.msHidden !== "undefined") {
                hidden = "msHidden";
            } else if (typeof document.webkitHidden !== "undefined") {
                hidden = "webkitHidden";
            }
            if (document[hidden]) throw "page-not-focused";
            return props;
        }
        const checkIfComponentInViewport = async props => {
            if (rootRef.current) {
                const rect = rootRef.current.getBoundingClientRect();
                if (!(rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                )) {
                    throw "item-not-visible";
                }
            }
            return props;
        }
        const fetchSelectedIndex = async props => {
            const {selectedIndex} = props;
            let selectedIndex_ = selectedIndex + 1;
            if (selectedIndex_ >= items.length) selectedIndex_ = 0;
            return {...props, selectedIndex: selectedIndex_}
        }
        const selectItem = async props => {
            const {selectedIndex} = props;
            const postData = items[selectedIndex].value;
            return {...props, postData};
        }
        const fetchUserData = async props => {
            const {postData} = props;
            const userData = await cacheDatas.fetch(postData.uid, id => {
                return UserData(firebase).fetch(id, [UserData.NAME, UserData.IMAGE]);
            });
            return {...props, userData};
        }
        const updateSelectedIndex = async props => {
            const {selectedIndex: selected} = props;
            selectedIndex = selected;
            return props;
        }
        const buildItemComponent = async props => {
            const {postData, userData} = props;
            const item = <ItemPlaceholderComponent
                avatar={<AvatarView
                    className={classes.avatarSmallest}
                    image={userData.image}
                    initials={userData.initials}
                    verified
                />}
                className={classes.singleline}
                label={<span className={classes.textSmall}>
                    <span className={classes.suggestionName}>
                        {userData.name}
                    </span> <MentionedTextComponent disableClick mentions={mentions} text={postData.text.substr(0,200)}/>
                </span>}
                pattern={"transparent"}
            />;
            return {...props, item};
        }
        const updateState = async props => {
            isMounted && setState(state => {
                const {item: itemPrev} = state;
                return ({...state, itemPrev, item, ...props})
            });
        }
        const installAnimation = async () => {
            setTimeout(() => {
                leavingRef.current && leavingRef.current.classList.add(classes.leaving);
            }, 10);
        }
        const thrownEvent = async event => {
            if (event instanceof Error) throw event;
            // console.log(event)
        }
        const finalizeRotating = async props => {
        }

        const process = () => {
            prepareRotating()
                .then(checkIfAppInForeground)
                .then(checkIfComponentInViewport)
                .then(fetchSelectedIndex)
                .then(selectItem)
                .then(fetchUserData)
                .then(updateSelectedIndex)
                .then(buildItemComponent)
                .then(updateState)
                .then(installAnimation)
                .catch(thrownEvent)
                .catch(notifySnackbar)
                .finally(finalizeRotating)
        }

        process();
        if (items.length > 1) {
            taskRef.current = setInterval(() => process(), 4000 + Math.random() * 1000);
        }

        return () => {
            clearInterval(taskRef.current);
            isMounted = false;
        }
    }, [items]);

    if (!item) return null;
    return <Grid item xs ref={rootRef} className={classes.root} onClick={handleClick}>
        {itemPrev && <Grid container key={Math.random()} ref={leavingRef} className={classes.moveable}>{itemPrev}</Grid>}
        <Grid container className={classes.moveable}>{item}</Grid>
    </Grid>
})
