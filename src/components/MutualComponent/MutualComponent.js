import React from "react";
import {useDispatch} from "react-redux";
import TextField from "@material-ui/core/TextField";
import {useTranslation} from "react-i18next";
import ActionComponent from "./ActionComponent";
import InfoComponent from "../InfoComponent";
import {MutualMode} from "./MutualConstants";
import {mutualRequest, mutualRequestAccept, mutualRequestReject} from "./mutualComponentControls";
import {useFirebase} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import ProgressView from "../ProgressView";
import notifySnackbar from "../../controllers/notifySnackbar";
import Pagination from "../../controllers/FirebasePagination";
import ConfirmComponent from "../ConfirmComponent";

export default props => {
    const {t} = useTranslation();
    const {
        acceptLabel = t("Mutual.Accept"),
        acceptComponent = <ActionComponent label={acceptLabel}/>,
        counter = true,
        counterComponent = <InfoComponent/>,
        counterRequestsComponent = <InfoComponent/>,
        onError = error => {
            console.error(error)
        },
        messageComponent = <InfoComponent/>,
        mutualId,
        mutualMode = MutualMode.SIMPLEX_QUIET,
        mutualType = "users_public",
        pendingLabel = t("Mutual.Waiting for response"),
        pendingComponent = <ActionComponent label={pendingLabel}/>,
        rejectLabel = t("Mutual.Reject"),
        rejectComponent = <ActionComponent label={rejectLabel}/>,
        subscribeLabel = t("Mutual.Subscribe"),
        subscribeComponent = <ActionComponent label={subscribeLabel}/>,
        typeId,
        unsubscribeLabel = t("Mutual.Unsubscribe"),
        unsubscribeComponent = <ActionComponent label={unsubscribeLabel}/>,
    } = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {
        disabled = true,
        hasPending,
        subscribed,
        subscribers,
        subscribes,
        message,
        messageOpen,
        requestsCounter = null,
        hasRequest
    } = state;
    const currentUserData = useCurrentUserData();

    const uidId = `${currentUserData.id}_${mutualId}`;
    const idUid = `${mutualId}_${currentUserData.id}`;
    const isAllowed = matchRole([Role.ADMIN, Role.USER], currentUserData);
    const isSameUser = currentUserData.id === mutualId;

    const pushRequest = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true, pending: true});
        mutualRequest({firebase, currentUserData, message, mutualId, mutualMode, mutualType, typeId})
            .then(hasPending => {
                if (mutualMode === MutualMode.DUPLEX_APPROVE) {
                    setState(state => ({
                        ...state,
                        messageOpen: false,
                        hasPending
                    }))
                }
            })
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const handleSubscribe = () => {
        if (!isAllowed) {
            onError(new Error(t("Mutual.Subscribe not allowed")));
            return;
        }
        if (mutualMode === MutualMode.SIMPLEX_QUIET) {
            pushRequest()
        } else if (mutualMode === MutualMode.DUPLEX_APPROVE) {
            setState(state => ({...state, messageOpen: true}));
        }
    }

    const handleUnsubscribe = () => {
        if (!isAllowed) {
            onError(new Error(t("Mutual.Unsubscribe not allowed")));
            return;
        }
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true, pending: false});
        new Pagination({
            ref: firebase.database().ref("mutual").child(typeId),
            child: "uid_id",
            equals: uidId,
            update: () => null
        }).next()
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const handleRequestResponse = isAccept => evt => {
        evt.stopPropagation();
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, hasPending: hasRequest, hasRequest: null, disabled: true}));
        (isAccept ? mutualRequestAccept : mutualRequestReject)({requestId: `${typeId}/${hasRequest.key}`, firebase})
            .then(result => {
                setState(state => ({...state, disabled: false}));
                dispatch(ProgressView.HIDE);
            })
            .catch(error => {
                notifySnackbar(error);
                setState(state => ({...state, disabled: false}));
                dispatch(ProgressView.HIDE);
            })
    }

    const handleChangeMessage = evt => {
        setState({...state, message: evt.target.value});
    }

    React.useEffect(() => {
        let isMounted = true;
        const pendingPagination = new Pagination({
            ref: firebase.database().ref("mutualrequests").child(typeId),
            child: "uid_id",
            equals: uidId,
            size: 1,
        });
        const subscribePagination = new Pagination({
            ref: firebase.database().ref("mutual").child(typeId),
            child: "uid_id",
            equals: uidId,
            size: 1,
        });
        pendingPagination.next()
            .then(items => items[0])
            .then(hasPending => {
                if (hasPending && isMounted) {
                    setState(state => ({
                        ...state,
                        hasPending,
                        disabled: false
                    }));
                    // eslint-disable-next-line no-throw-literal
                    throw "done";
                }
            })
            .then(() => subscribePagination.next())
            .then(items => items[0])
            .then(subscribed => {
                isMounted && setState(state => ({
                    ...state,
                    subscribed,
                    disabled: false
                }));
            })
            .catch(error => {
                if (error !== "done") notifySnackbar(error);
            });
        return () => isMounted = false;
    }, [uidId, typeId, subscribers, firebase]);

    // noinspection DuplicatedCode
    React.useEffect(() => {
        const counterRef = firebase.database().ref(`_counters/${mutualId}/mutual/${typeId}_s`);
        const listener = snapshot => {
            const subscribers = snapshot.val();
            setState(state => ({
                ...state,
                disabled: false,
                ...(state.pending === undefined ? {} : {subscribed: state.pending}),
                subscribers,
            }));
        }
        counterRef.on("value", listener);
        return () => counterRef.off("value", listener);
    }, [mutualId, typeId, firebase]);

    // noinspection DuplicatedCode
    React.useEffect(() => {
        if (mutualMode !== MutualMode.DUPLEX_APPROVE) return;
        const counterRef = firebase.database().ref(`_counters/${mutualId}/mutual/${typeId}`);
        const listener = snapshot => {
            const subscribes = snapshot.val();
            setState(state => ({
                ...state,
                disabled: false,
                ...(state.pending === undefined ? {} : {subscribed: state.pending}),
                subscribes,
            }));
        }
        counterRef.on("value", listener);
        return () => counterRef.off("value", listener);
    }, [mutualId, typeId, firebase, mutualMode]);

    React.useEffect(() => {
        if (!hasPending) return;
        const pendingRef = firebase.database().ref("mutualrequests").child(typeId).child(hasPending.key)
        const listener = snapshot => {
            if (!snapshot.exists()) {
                setState(state => ({...state, hasPending: null, disabled: false}))
            }
        }
        pendingRef.on("value", listener)
        return () => pendingRef.off("value", listener);
    }, [hasPending, firebase, typeId])

    React.useEffect(() => {
        if (mutualMode !== MutualMode.DUPLEX_APPROVE) return;
        const requestCounterRef = firebase.database().ref("_counters").child(currentUserData.id).child("mutualrequests").child(typeId);
        const listener = snapshot => {
            const requestsCounter = snapshot.val();
            setState(state => ({...state, requestsCounter}))
        }
        requestCounterRef.on("value", listener)
        return () => requestCounterRef.off("value", listener);
    }, [mutualId, typeId, mutualMode, firebase, isSameUser, currentUserData.id])

    React.useEffect(() => {
        if (mutualMode !== MutualMode.DUPLEX_APPROVE) return;
        let isMutualRequestsCheckMount = true;
        new Pagination({
            ref: firebase.database().ref("mutualrequests").child(typeId),
            child: "uid_id",
            equals: idUid,
        }).next()
            .then(items => items && items[0])
            .then(hasRequest => {
                if (hasRequest && isMutualRequestsCheckMount) {
                    setState(state => ({...state, hasRequest}))
                }
            });
        return () => {
            isMutualRequestsCheckMount = false;
        }
    }, [typeId, mutualMode, firebase, requestsCounter, idUid])

    // console.log(requestsCounter, subscribers, hasPending, hasRequest)
    return <>
        {isAllowed && currentUserData.id !== mutualId && <>
            {hasPending && pendingComponent && <pendingComponent.type
                {...pendingComponent.props}
                disabled
            />}
            {!hasPending && !hasRequest && !subscribed && subscribeComponent && <subscribeComponent.type
                {...subscribeComponent.props}
                disabled={disabled}
                onClick={handleSubscribe}
            />}
            {hasRequest && acceptComponent && rejectComponent && <>
                <acceptComponent.type
                    {...acceptComponent.props}
                    disabled={disabled}
                    onClick={handleRequestResponse(true)}
                />
                <rejectComponent.type
                    {...rejectComponent.props}
                    disabled={disabled}
                    onClick={handleRequestResponse(false)}
                />
                {hasRequest.value && hasRequest.value.message && messageComponent && <messageComponent.type
                    {...messageComponent.props}
                    children={hasRequest.value.message}
                />}
            </>}
            {!hasPending && subscribed && unsubscribeComponent && <unsubscribeComponent.type
                {...unsubscribeComponent.props}
                disabled={disabled}
                onClick={handleUnsubscribe}
            />}
        </>}
        {counter && (mutualMode === MutualMode.SIMPLEX_QUIET) && subscribed && counterComponent && <counterComponent.type
            suffix={`${typeId}(s)`}
            {...counterComponent.props}
            children={subscribers}
        />}
        {counter && (mutualMode === MutualMode.DUPLEX_APPROVE) && counterComponent && <counterComponent.type
            suffix={`${typeId}(s)`}
            {...counterComponent.props}
            children={subscribes}
        />}
        {isSameUser && requestsCounter && counterRequestsComponent && <counterRequestsComponent.type
            suffix={"request(s)"}
            {...counterRequestsComponent.props}
            children={requestsCounter}
        />}
        {messageOpen && <ConfirmComponent
            confirmLabel={t("Mutual.Invite")}
            onCancel={() => setState(state => ({...state, messageOpen: false}))}
            onConfirm={() => pushRequest()}
            title={t("Mutual.Send the specialized message with your invitation.")}
        >
            <TextField
                color={"secondary"}
                fullWidth
                label={t("Mutual.Message")}
                placeholder={t("Mutual.Type message here")}
                multiline
                rows={3}
                onChange={handleChangeMessage}
                value={message}
            />
        </ConfirmComponent>}
    </>
};
