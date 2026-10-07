import EndDateIcon from "@mui/icons-material/Event";
import RefreshIcon from "@mui/icons-material/Refresh";
import SortIcon from "@mui/icons-material/Sort";
import StartDateIcon from "@mui/icons-material/Today";
import React from "react";
import {connect, useDispatch} from "react-redux";
import AvatarView from "../../../components/AvatarView";
import DateTimePicker from "../../../components/DateTimePicker/DateTimePicker";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import MentionedSelectComponent from "../../../components/MentionedSelectComponent";
import NavigationToolbar from "../../../components/NavigationToolbar";
import {toDateString} from "../../../controllers/DateFormat";
import Pagination from "../../../controllers/FirebasePagination";
import {cacheDatas, useWindowData} from "../../../controllers/General";
import {mentionUsers} from "../../../controllers/mentionTypes";
import notifySnackbar from "../../../controllers/notifySnackbar";
import {UserData} from "../../../controllers/UserData";
import Button from "../../../controls/Button/Button";
import Chip from "../../../controls/Chip/Chip";
import Select from "../../../controls/Select/Select";
import baseStyles from "../../../themes/Base.module.css";
import ActivityItemComponent from "./ActivityItemComponent";
import {auditReducer} from "./auditReducer";
import activityStyles from "./styles/Activity.module.css";
import ClearIcon from "@mui/icons-material/Clear";

const Activity = props => {
    const {
        activityMode = "all",
        activityFilterItem,
        activityFilter,
        activitySort = "asc"
    } = props;
    const dispatch = useDispatch();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {random, startDate, endDate, startDateAnchor, endDateAnchor} = state;

    const handleItemClick = activityMode => (event, activityFilterItem) => {
        event && event.stopPropagation();
        dispatch({type: auditReducer.ACTIVITY, activityMode, activityFilterItem, activitySort});
    }

    const handleMode = evt => {
        dispatch({type: lazyListComponentReducer.RESET});
        dispatch({type: auditReducer.ACTIVITY, activityMode: evt.target.value, activitySort});
    }

    const handleSortClick = evt => {
        const sort = activitySort === "asc" ? "desc" : "asc";
        dispatch({type: lazyListComponentReducer.RESET});
        dispatch({
            type: auditReducer.ACTIVITY,
            activityMode,
            activityFilterItem,
            activityFilter,
            activitySort: sort
        });
    }

    const handleTypeSelect = evt => {
        const activityFilterItem = evt.target.value;
        dispatch({type: lazyListComponentReducer.RESET});
        dispatch({type: auditReducer.ACTIVITY, activityMode, activityFilterItem, activitySort});
    }

    const handleStartDate = startDate => {
        dispatch({type: lazyListComponentReducer.RESET});
        setState({
            ...state,
            startDate,
            startDateAnchor: null,
        });
    };

    const handleEndDate = endDate => {
        dispatch({type: lazyListComponentReducer.RESET});
        setState({
            ...state,
            endDate,
            endDateAnchor: null,
        });
    };

    const getDatePopoverStyle = anchor => {
        if (!anchor || !anchor.getBoundingClientRect) {
            return undefined;
        }
        const bounds = anchor.getBoundingClientRect();
        return {
            left: bounds.left,
            top: bounds.bottom,
        };
    };

    let itemTransform = item => item;
    let itemComponent = item => <ActivityItemComponent
        data={item}
        key={item.key}
        onItemClick={handleItemClick}
    />

    let pagination;
    switch (activityMode) {
        case "all":
            pagination = new Pagination({
                endDate: endDate ? endDate.toDate() : undefined,
                order: activitySort,
                ref: "activity",
                startDate: startDate ? startDate.toDate() : undefined,
            })
            break;
        case "type":
            pagination = new Pagination({
                child: "type",
                endDate: endDate ? endDate.toDate() : undefined,
                equals: activityFilterItem,
                order: activitySort,
                ref: "activity",
                start: activityFilter,
                startDate: startDate ? startDate.toDate() : undefined,
            })
            break;
        case "uid":
            pagination = new Pagination({
                child: "uid",
                endDate: endDate ? endDate.toDate() : undefined,
                equals: activityFilterItem,
                order: activitySort,
                ref: "activity",
                startDate: startDate ? startDate.toDate() : undefined,
            })
            break;
        default:
    }

    const filteredItem = (() => {
        if (!activityFilterItem) return undefined;
        if (activityMode === "uid" && activityFilterItem === "0") return {name: "No user"};
        if (activityMode === "uid") return cacheDatas.get(activityFilterItem);
        if (activityMode === "type") {
            return {
                image: null,
                initials: activityFilterItem,
                name: activityFilterItem
            };
        }
    })();

    const clearFilteredItem = () => {
        dispatch({
            type: auditReducer.ACTIVITY,
            activityMode,
            activitySort
        });
        dispatch({type: lazyListComponentReducer.RESET});
    };

    const clearStartDate = () => {
        dispatch({type: lazyListComponentReducer.RESET});
        setState(state => ({...state, startDate: null}));
    };

    const clearEndDate = () => {
        dispatch({type: lazyListComponentReducer.RESET});
        setState(state => ({...state, endDate: null}));
    };

    return <>
        <NavigationToolbar
            backButton={null}
            mediumButton={<>
                {!windowData.isNarrow() && <div className={activityStyles.dateButtons}>
                    <Button
                        icon={<StartDateIcon/>}
                        onClick={event => setState(state => ({
                            ...state,
                            startDateAnchor: event.currentTarget
                        }))}
                        title={"Start date"}
                    />
                    <span className={activityStyles.separator}>&mdash;</span>
                    <Button
                        icon={<EndDateIcon/>}
                        onClick={event => setState(state => ({
                            ...state,
                            endDateAnchor: event.currentTarget
                        }))}
                        title={"End date"}
                    />
                </div>}
            <Button
                className={[activitySort === "asc" ? activityStyles.sortAsc : activityStyles.sortDesc].join(" ")}
                icon={<SortIcon/>}
                onClick={handleSortClick}
                title={"Sort activity"}
            />
        </>}
            rightButton={<Button
                    icon={<RefreshIcon/>}
                    onClick={() => setState({...state, random: Math.random()})}
                    title={"Refresh activity"}
                />}
        >
            <div className={activityStyles.toolbarRow}>
                <div className={activityStyles.modeCell}>
                    <Select
                        onChange={handleMode}
                        options={[
                            {label: "All", value: "all"},
                            {label: "By type", value: "type"},
                            {label: "By person", value: "uid"},
                        ]}
                        value={activityMode}
                    />
                </div>
                <div className={activityStyles.filterCell}>
                    {activityMode === "uid" && !filteredItem && <MentionedSelectComponent
                        combobox
                        mention={{
                            ...mentionUsers,
                            displayTransform: (id, display) => display,
                            trigger: ""
                        }}
                        onChange={(evt, value, token) => {
                            token && cacheDatas.fetch(token.id, id => {
                                return UserData().fetch(id);
                            }).then(() => handleItemClick("uid")(null, token.id))
                                .catch(notifySnackbar);
                        }}
                        placeholder={"Filter"}
                    />}
                    {activityMode === "type" && !filteredItem && <MentionedSelectComponent
                        mention={{
                            pagination: start => new Pagination({
                                ref: "_activity/types",
                                order: "asc",
                                size: 100,
                            }),
                            transform: item => ({id: item.key, display: item.key}),
                        }}
                        onChange={handleTypeSelect}
                    />}
                </div>
            </div>
            <div className={activityStyles.filterRow}>
                <div className={activityStyles.chips}>
                    {filteredItem && <Chip
                        avatar={<AvatarView
                            alt={"Avatar"}
                            image={filteredItem.image}
                            initials={filteredItem.name}
                            verified={true}
                        />}
                        label={filteredItem.name}
                        onDelete={clearFilteredItem}
                    />}
                    {activityMode === "type" && !filteredItem && <Chip
                        color='secondary'
                        label='Needs select type'
                    />}
                    {activityMode === "uid" && !filteredItem && <Chip
                        color='secondary'
                        label='Needs select person'
                    />}
                    {startDate && <Chip
                        avatar={<StartDateIcon/>}
                        label={toDateString(startDate.toDate().getTime())}
                        onDelete={clearStartDate}
                    />}
                    {endDate && <Chip
                        avatar={<EndDateIcon/>}
                        label={toDateString(endDate.toDate().getTime())}
                        onDelete={clearEndDate}
                    />}
                </div>
                {windowData.isNarrow() && <div className={activityStyles.dateButtons}>
                    <Button
                        icon={<StartDateIcon/>}
                        onClick={event => setState(state => ({
                            ...state,
                            startDateAnchor: event.currentTarget
                        }))}
                        title={"Start date"}
                    />
                    <span className={activityStyles.separator}>&mdash;</span>
                    <Button
                        icon={<EndDateIcon/>}
                        onClick={event => setState(state => ({
                            ...state,
                            endDateAnchor: event.currentTarget
                        }))}
                        title={"End date"}
                    />
                </div>}
            </div>
        </NavigationToolbar>
        <div className={[baseStyles.content, activityStyles.center].filter(Boolean).join(" ")}>
            <LazyListComponent
                key={random}
                itemComponent={itemComponent}
                itemTransform={itemTransform}
                noItemsComponent={<ActivityItemComponent label={"No activities found"}/>}
                pagination={pagination}
                placeholder={<ActivityItemComponent skeleton={true}/>}
            />
        </div>
        {startDateAnchor && <div
            className={activityStyles.datePopover}
            style={getDatePopoverStyle(startDateAnchor)}
        >
            <DateTimePicker
                color='secondary'
                inline
                label='Start date'
                onChange={handleStartDate}
                date={startDate}
            />
        </div>}
        {endDateAnchor && <div
            className={activityStyles.datePopover}
            style={getDatePopoverStyle(endDateAnchor)}
        >
            <DateTimePicker
                color='secondary'
                inline
                label='End date'
                onChange={handleEndDate}
                date={startDate}
            />
        </div>}
    </>
};

const mapStateToProps = ({audit}) => ({
    activityFilterItem: audit.activityFilterItem,
    activityFilter: audit.activityFilter,
    activityMode: audit.activityMode,
    activitySort: audit.activitySort,
});

export default connect(mapStateToProps)(Activity);
