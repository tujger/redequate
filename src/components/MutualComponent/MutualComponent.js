import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {useBackend, useDatabase} from "../../controllers";
import counterControl from "../../controllers/counterControl";
import notifySnackbar from "../../controllers/notifySnackbar";
import {useCurrentUserDataValue} from "../../controllers/useCurrentUserData";
import {matchRole, UserRole} from "../../controllers/UserData";
import TextField from "../../controls/TextField/TextField";
import ConfirmComponent from "../ConfirmComponent";
import InfoComponent from "../InfoComponent";
import ProgressView from "../ProgressView";
import ActionComponent from "./ActionComponent";
import {mutualRequest, mutualRequestAccept, mutualRequestReject} from "./mutualComponentControls";
import {MutualMode} from "./MutualConstants";

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
        rejectComponent = <ActionComponent label={rejectLabel} color={"secondary"} variant={"outlined"}/>,
        subscribeLabel = t("Mutual.Subscribe"),
        subscribeComponent = <ActionComponent label={subscribeLabel}/>,
        typeId,
        unsubscribeLabel = t("Mutual.Unsubscribe"),
        unsubscribeComponent = <ActionComponent label={unsubscribeLabel}/>,
    } = props;
    const backend = useBackend();
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
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

    const uidId = `${currentUserData.id}_${mutualId}`;
    const idUid = `${mutualId}_${currentUserData.id}`;
    const isAllowed = matchRole([UserRole.ADMIN, UserRole.USER], currentUserData);
    const isSameUser = currentUserData.id === mutualId;

    const pushRequest = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, disabled: true, pending: true});
        mutualRequest({currentUserData, database, message, mutualId, mutualMode, mutualType, typeId})
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

        database.cursor(["mutual", {typeId, _: true}], {
            equalTo: uidId,
            handle: () => null,
            orderBy: ["uid_id"],
        }).next(10)
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const handleRequestResponse = isAccept => evt => {
        evt.stopPropagation();
        dispatch(ProgressView.SHOW);
        setState(state => ({...state, hasPending: hasRequest, hasRequest: null, disabled: true}));
        (isAccept ? mutualRequestAccept : mutualRequestReject)({backend, typeId, requestId: hasRequest.key})
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
        database.cursor(["mutualrequests", {typeId, _: true}], {
            equalTo: uidId,
            orderBy: ["uid_id"]
        }).next().then(items => items[0])
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
            .then(() => database.cursor(["mutual", {typeId, _: true}], {
                equalTo: uidId,
                orderBy: ["uid_id"]
            }).next())
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
        return () => {
            isMounted = false;
        };
    }, [uidId, typeId, subscribers]);

    // noinspection DuplicatedCode
    React.useEffect(() => {
        const listener = counterControl({
            database,
            onchange: subscribers => {
                setState(state => ({
                    ...state,
                    disabled: false,
                    ...(state.pending === undefined ? {} : {subscribed: state.pending}),
                    subscribers,
                }))
            },
            path: [{id: mutualId}, "mutual", {typeId, _: true}, "s"]
        })
        return () => listener();
    }, [mutualId, typeId]);

    // noinspection DuplicatedCode
    React.useEffect(() => {
        if (mutualMode !== MutualMode.DUPLEX_APPROVE) return;
        const listener = counterControl({
            database,
            onchange: subscribes => {
                setState(state => ({
                    ...state,
                    disabled: false,
                    ...(state.pending === undefined ? {} : {subscribed: state.pending}),
                    subscribes,
                }))
            },
            path: [{id: mutualId}, "mutual", {typeId, _: true}]
        })
        return () => listener();
    }, [mutualId, typeId, mutualMode]);

    React.useEffect(() => {
        if (!hasPending) return;
        const listener = database.addEventListener(["mutualrequests", {typeId, _: true}, {pending: hasPending.key}], {
            onChange(value) {
                if (value === undefined)
                    setState(state => ({...state, hasPending: null, disabled: false}))
            }
        })
        return () => listener.remove();
    }, [hasPending, typeId])

    React.useEffect(() => {
        if (mutualMode !== MutualMode.DUPLEX_APPROVE) return;
        const listener = counterControl({
            database,
            onchange: requestsCounter => {
                setState(state => ({...state, requestsCounter}))
            },
            path: [{id: currentUserData.id}, "mutualrequests", {typeId, _:true}]
        });
        return () => listener();
    }, [mutualId, typeId, mutualMode, isSameUser, currentUserData.id])

    React.useEffect(() => {
        if (mutualMode !== MutualMode.DUPLEX_APPROVE) return;
        let isMutualRequestsCheckMount = true;
        database.cursor(["mutualrequests", {typeId, _: true}], {
            equalTo: idUid,
            orderBy: ["uid_id"]
        }).next(10)
            .then(items => items && items[0])
            .then(hasRequest => {
                if (hasRequest && isMutualRequestsCheckMount) {
                    setState(state => ({...state, hasRequest}))
                }
            });
        return () => {
            isMutualRequestsCheckMount = false;
        }
    }, [typeId, mutualMode, requestsCounter, idUid])

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
        {counter && (mutualMode === MutualMode.SIMPLEX_QUIET) && subscribed && counterComponent &&
            <counterComponent.type
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
                clearable={false}
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
