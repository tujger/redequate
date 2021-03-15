import React from "react";
import {connect, useDispatch} from "react-redux";
import RefreshIcon from "@material-ui/icons/Refresh";
import StartDateIcon from "@material-ui/icons/Today";
import EndDateIcon from "@material-ui/icons/Event";
import SortIcon from "@material-ui/icons/Sort";
import IconButton from "@material-ui/core/IconButton";
import Popover from "@material-ui/core/Popover";
import Select from "@material-ui/core/Select";
import Chip from "@material-ui/core/Chip";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import Pagination from "../../../controllers/FirebasePagination";
import {cacheDatas, useWindowData} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import withStyles from "@material-ui/styles/withStyles";
import {styles} from "../../../controllers/Theme";
import {auditReducer} from "./auditReducer";
import ActivityItemComponent from "./ActivityItemComponent";
import DateTimePicker from "../../../components/DateTimePicker/DateTimePicker";
import {toDateString} from "../../../controllers/DateFormat";
import MentionedSelectComponent from "../../../components/MentionedSelectComponent";
import {mentionUsers} from "../../../controllers/mentionTypes";
import notifySnackbar from "../../../controllers/notifySnackbar";
import {UserData} from "../../../controllers/UserData";

const Activity = (props) => {
    const {
        classes,
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

    const handleStartDate = (startDate) => {
        dispatch({type: lazyListComponentReducer.RESET});
        setState({
            ...state,
            startDate,
            startDateAnchor: null,
        });
    };

    const handleEndDate = (endDate) => {
        dispatch({type: lazyListComponentReducer.RESET});
        setState({
            ...state,
            endDate,
            endDateAnchor: null,
        });
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
        if (activityMode === "type") return {
            image: null,
            initials: activityFilterItem,
            name: activityFilterItem
        };
    })();

    return <>
        <Grid container className={classes.topSticky}>
            <Grid container alignItems={"center"}>
                <Grid item>
                    <Select
                        color={"secondary"}
                        onChange={handleMode}
                        value={activityMode}
                    >
                        <MenuItem value={"all"}>All</MenuItem>
                        <MenuItem value={"type"}>By type</MenuItem>
                        <MenuItem value={"uid"}>By person</MenuItem>
                    </Select>
                </Grid>
                <Grid item xs>
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
                            pagination: (start) => new Pagination({
                                ref: "_activity/types",
                                order: "asc",
                                size: 100,
                            }),
                            transform: item => ({id: item.key, display: item.key}),
                        }}
                        onChange={handleTypeSelect}
                    />}
                </Grid>
                {!windowData.isNarrow() && <Grid item>
                    <IconButton
                        aria-label={"start date"}
                        children={<StartDateIcon/>}
                        edge={"end"}
                        onClick={(event) => setState(state => ({
                            ...state,
                            startDateAnchor: event.target
                        }))}
                    />
                    &mdash;
                    <IconButton
                        aria-label={"end date"}
                        children={<EndDateIcon/>}
                        edge={"start"}
                        onClick={(event) => setState(state => ({
                            ...state,
                            endDateAnchor: event.target
                        }))}
                    />
                </Grid>}
                <Grid item><IconButton
                    children={<SortIcon/>}
                    className={"MuiButton-sort-" + activitySort}
                    onClick={handleSortClick}
                /></Grid>
                <Grid item>
                    <IconButton
                        children={<RefreshIcon/>}
                        onClick={() => setState({...state, random: Math.random()})}
                    />
                </Grid>
            </Grid>
            <Grid container alignItems={"flex-start"}>
                <Grid item xs>
                    {filteredItem && <Chip
                        avatar={<AvatarView
                            alt={"Avatar"}
                            className={classes.avatarSmallest}
                            image={filteredItem.image}
                            initials={filteredItem.name}
                            verified={true}
                        />}
                        label={filteredItem.name}
                        onDelete={() => {
                            dispatch({
                                type: auditReducer.ACTIVITY,
                                activityMode,
                                activitySort
                            });
                            dispatch({type: lazyListComponentReducer.RESET});
                        }}
                    />}
                    {activityMode === "type" && !filteredItem && <Chip
                        avatar={null}
                        color={"secondary"}
                        label={"Needs select type"}
                    />}
                    {activityMode === "uid" && !filteredItem && <Chip
                        avatar={null}
                        color={"secondary"}
                        label={"Needs select person"}
                    />}
                    {startDate && <Chip
                        avatar={<StartDateIcon/>}
                        label={toDateString(startDate.toDate().getTime())}
                        onDelete={() => {
                            dispatch({type: lazyListComponentReducer.RESET});
                            setState(state => ({...state, startDate: null}));
                        }}
                    />}
                    {endDate && <Chip
                        avatar={<EndDateIcon/>}
                        label={toDateString(endDate.toDate().getTime())}
                        onDelete={() => {
                            dispatch({type: lazyListComponentReducer.RESET});
                            setState(state => ({...state, endDate: null}));
                        }}
                    />}
                </Grid>
                {windowData.isNarrow() && <Grid item>
                    <IconButton
                        aria-label={"start date"}
                        children={<StartDateIcon/>}
                        edge={"end"}
                        onClick={(event) => setState(state => ({
                            ...state,
                            startDateAnchor: event.target
                        }))}
                    />
                    &mdash;
                    <IconButton
                        aria-label={"end date"}
                        children={<EndDateIcon/>}
                        edge={"start"}
                        onClick={(event) => setState(state => ({
                            ...state,
                            endDateAnchor: event.target
                        }))}
                    />
                </Grid>}
            </Grid>
        </Grid>
        <Grid container className={classes.center}>
            <LazyListComponent
                key={random}
                itemComponent={itemComponent}
                itemTransform={itemTransform}
                noItemsComponent={<ActivityItemComponent label={"No activities found"}/>}
                pagination={pagination}
                placeholder={<ActivityItemComponent skeleton={true}/>}
            />
        </Grid>
        {startDateAnchor && <Popover anchorEl={startDateAnchor} open>
            <DateTimePicker
                color={"secondary"}
                inline
                label="Start date"
                onChange={handleStartDate}
                date={startDate}
            />
        </Popover>}
        {endDateAnchor && <Popover anchorEl={endDateAnchor} open>
            <DateTimePicker
                color={"secondary"}
                inline
                label="End date"
                onChange={handleEndDate}
                date={startDate}
            />
        </Popover>}
    </>
};

const mapStateToProps = ({audit}) => ({
    activityFilterItem: audit.activityFilterItem,
    activityFilter: audit.activityFilter,
    activityMode: audit.activityMode,
    activitySort: audit.activitySort,
});

export default connect(mapStateToProps)(withStyles(styles)(Activity));
