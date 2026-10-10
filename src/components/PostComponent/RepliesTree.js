import React from "react";
import {useHistory} from "react-router-dom";
import {useBackend} from "../../../packages/backend";
import Pagination from "../../controllers/FirebasePagination";
import {useMetaInfo, usePages, useWindowData} from "../../controllers/General";
import notifySnackbar from "../../controllers/notifySnackbar";
import {useCurrentUserData, UserData} from "../../controllers/UserData";
import UserName from "../../controls/UserName/UserName";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import LazyListComponent from "../LazyListComponent/LazyListComponent";
import postItemTransform from "./postItemTransform";
import RotatingReplies from "./RotatingReplies";
import cardStyles from "./styles/PostComponent.module.css";
import replyStyles from "./styles/PostReplies.module.css";

export default (props) => {
    const {PostComponent, ...replyProps} = props;
    const {allowedExtras, level, postId, type, expand, onChange, expanded: givenExpanded} = replyProps;
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const pages = usePages();
    const backend = useBackend();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {expanded, replies, userReplied, paginationOptions, rotating} = state;
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {postsRotateReplies} = settings;

    const MAX_INDENTING_LEVELS = windowData.isNarrow() ? 2 : 10;

    React.useEffect(() => {
        let isMounted = true;
        const paginationOptions = {
            ref: type,
            equals: postId,
            child: "to",
            order: "desc",
        };

        const prepareChecking = async () => {
            // throw {expanded: true, a:0};
        }
        const throwIfPostOnIndex = async () => {
            if (level === undefined) {
                return fetchExistingRepliesIfComment()
                    .then(replies => {
                        throw {expanded: false, rotating: true, replies};
                    })
            }
        }
        const throwExpandIfGivenExpanded = async () => {
            if (givenExpanded) throw {expanded: true, a: 1};
        }
        const throwExpandIfForceExpanded = async () => {
            if (expand && level === 0) {
                throw {
                    expanded: true,
                    paginationOptions: {
                        ref: type,
                        equals: expand,
                    },
                    a: 2
                };
            }
            if (level > 0 && expand) throw {expanded: true, a: 3};
        }
        const throwExpandIfReply = async () => {
            if (level > 1) throw {expanded: true, a: 4};
        }
        const throwExpandIfShowingPost = async () => {
            if (level === 0) throw {expanded: true, a: 5};
        }
        const fetchExistingRepliesIfComment = async () => {
            const pagination = new Pagination(paginationOptions);
            return pagination.next();
        }
        const fetchFirstAuthorOfReplies = async replies => {
            if (replies[0]) {
                return UserData()
                    .fetch(replies[0].value.uid, [UserData.NAME, UserData.IMAGE])
                    .then(userReplied => {
                        throw {replies, userReplied};
                    })
            }
            throw {expanded: false, a: 6};
        }
        const throwInfoToExpand = async ({replies, userReplied}) => {
            throw {replies, userReplied};
        }
        const updateState = async props => {
            // console.error(postId, {paginationOptions, ...props})
            if (props instanceof Error) throw props;
            isMounted && setState(state => ({...state, paginationOptions, ...props}))
        }
        const finalizeChecking = async () => {
        }

        prepareChecking()
            .then(throwExpandIfGivenExpanded)
            .then(throwIfPostOnIndex)
            .then(throwExpandIfForceExpanded)
            .then(throwExpandIfReply)
            .then(throwExpandIfShowingPost)
            .then(fetchExistingRepliesIfComment)
            .then(fetchFirstAuthorOfReplies)
            // .then(throwInfoToExpand)
            .catch(updateState)
            .catch(notifySnackbar)
            .finally(finalizeChecking)

        return () => {
            isMounted = false;
        }
    }, [givenExpanded]);

    if (!paginationOptions) return null;
    if (postsRotateReplies === "outside" && rotating && replies && replies.length) {
        return <div className={replyStyles.replyRow}>
            <div className={replyStyles.replyIndent}/>
            <div className={cardStyles.replyContent}>
                <RotatingReplies {...replyProps} items={replies}/>
            </div>
        </div>
    }

    if (!expanded && !userReplied) return null;
    if (!expanded) {
        return <div className={replyStyles.replyRow}>
            <div className={replyStyles.replyIndent}/>
            <div className={cardStyles.replyContent}>
                <ItemPlaceholderComponent
                    avatar={<AvatarView
                        // className={cardStyles.avatarSmallest}
                        image={userReplied.image}
                        initials={userReplied.initials}
                        size={"small"}
                        verified
                    />}
                    label={<span className={cardStyles.textSmall}>
                        <UserName id={userReplied.id}>{userReplied.name}</UserName>
                        {replies && replies.length > 1 ? " and others replied" : " replied"}
                    </span>}
                    pattern={"transparent"}
                    onClick={() => {
                        setState(state => ({...state, expanded: true}));
                    }}
                />
            </div>
        </div>
    }

    return <>
        {expand && level === 0 && <div className={replyStyles.replyRow}>
            <div className={cardStyles.replyContent}>
                <ItemPlaceholderComponent
                    avatar={null}
                    label={<span className={cardStyles.textSmall}>
                        Click here to see the entire thread.
                    </span>}
                    pattern={"flat"}
                    onClick={() => history.push(pages.post.route + postId)}
                />
            </div>
        </div>}
        <div className={[replyStyles.replyRow, level > 1 ? replyStyles.sectionReply : replyStyles.sectionComment].join(" ")}>
            {level > 0 && level < MAX_INDENTING_LEVELS && <div className={replyStyles.replyIndent}/>}
            <div className={cardStyles.replyContent}>
                <LazyListComponent
                    disableProgress={true}
                    pagination={() => new Pagination(paginationOptions)}
                    itemTransform={postItemTransform({
                        allowedExtras,
                        backend,
                        currentUserData,
                        type,
                    })}
                    itemComponent={item => <PostComponent
                        {...replyProps}
                        collapsible={false}
                        disableClick
                        isReply={true}
                        key={item.id}
                        level={expanded ? level + 1 : undefined}
                        onChange={onChange}
                        pattern={"cloud"}
                        postData={item}
                        showRepliesCounter={false}
                        userData={item._userData}
                    />}
                    placeholder={<PostComponent avatar={null} skeleton={true} pattern={"cloud"}/>}
                />
            </div>
        </div>
    </>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
