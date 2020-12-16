import React from "react";
import {connect, useDispatch} from "react-redux";
import ClearIcon from "@material-ui/icons/Clear";
import RefreshIcon from "@material-ui/icons/Refresh";
import StartDateIcon from "@material-ui/icons/Today";
import EndDateIcon from "@material-ui/icons/Event";
import SortIcon from "@material-ui/icons/Sort";
import IconButton from "@material-ui/core/IconButton";
import Popover from "@material-ui/core/Popover";
import Input from "@material-ui/core/Input";
import Select from "@material-ui/core/Select";
import Chip from "@material-ui/core/Chip";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import Pagination from "../../../controllers/FirebasePagination";
import {cacheDatas, useFirebase} from "../../../controllers/General";
import AvatarView from "../../../components/AvatarView";
import NavigationToolbar from "../../../components/NavigationToolbar";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import withStyles from "@material-ui/styles/withStyles";
import {styles} from "../../../controllers/Theme";
import {auditReducer} from "./auditReducer";
import ActivityItemComponent from "./ActivityItemComponent";
import DateTimePicker from "../../../components/DateTimePicker/DateTimePicker";
import {toDateString} from "../../../controllers/DateFormat";

const Activity = (props) => {
    const {classes, activityMode = "all", activityFilterItem, activityFilter, activitySort = "asc"} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {random, startDate, endDate, startDateAnchor, endDateAnchor} = state;

    const handleItemClick = activityMode => (event, activityFilterItem) => {
        event && event.stopPropagation();
        dispatch({type: auditReducer.ACTIVITY, activityMode, activityFilterItem, activitySort});
    }

    const handleFilterChange = action => event => {
        dispatch({type: lazyListComponentReducer.RESET});
        if (action === "clear") {
            dispatch({type: auditReducer.ACTIVITY, activityFilter: undefined, activityMode, activitySort});
        } else {
            dispatch({
                type: auditReducer.ACTIVITY,
                activityFilter: event.target.value || undefined,
                activityMode,
                activitySort
            });
        }
    }

    const handleMode = evt => {
        dispatch({type: lazyListComponentReducer.RESET});
        dispatch({type: auditReducer.ACTIVITY, activityMode: evt.target.value, activitySort});
    }

    const handleSortClick = evt => {
        const sort = activitySort === "asc" ? "desc" : "asc";
        dispatch({type: lazyListComponentReducer.RESET});
        dispatch({type: auditReducer.ACTIVITY, activityMode, activityFilterItem, activityFilter, activitySort: sort});
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
                endDate: endDate ? endDate.toDate() : null,
                order: activitySort,
                ref: firebase.database().ref("activity"),
                startDate: startDate ? startDate.toDate() : null,
            })
            break;
        case "type":
            pagination = new Pagination({
                child: "type",
                endDate: endDate ? endDate.toDate() : null,
                equals: activityFilterItem,
                order: activitySort,
                ref: firebase.database().ref("activity"),
                start: activityFilter,
                startDate: startDate ? startDate.toDate() : null,
            })
            break;
        case "uid":
            pagination = new Pagination({
                child: "uid",
                endDate: endDate ? endDate.toDate() : null,
                equals: activityFilterItem,
                order: activitySort,
                ref: firebase.database().ref("activity"),
                startDate: startDate ? startDate.toDate() : null,
            })
            break;
        default:
    }

    const filteredItem = (() => {
        if (!activityFilterItem) return undefined;
        if (activityMode === "uid") return cacheDatas.get(activityFilterItem);
        if (activityMode === "type") return {image: null, initials: activityFilterItem, name: activityFilterItem};
    })();

    return <>
        <Grid container className={classes.topSticky}>
            <Grid container alignItems={"flex-start"}>
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
                    {!filteredItem && (activityMode !== "uid") && <Input
                        autoFocus
                        color={"secondary"}
                        endAdornment={activityFilter
                            ? <IconButton
                                children={<ClearIcon/>}
                                onClick={handleFilterChange("clear")}
                                size={"small"}
                                title={"Clear"}
                                variant={"text"}
                            /> : null}
                        onChange={handleFilterChange("filter")}
                        placeholder={"Search"}
                        value={activityFilter || ""}
                    />}
                </Grid>
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
                <Grid item>
                    <IconButton
                        aria-label={"start date"}
                        children={<StartDateIcon/>}
                        edge={"end"}
                        onClick={(event) => setState(state => ({...state, startDateAnchor: event.target}))}
                    />
                    &mdash;
                    <IconButton
                        aria-label={"end date"}
                        children={<EndDateIcon/>}
                        edge={"start"}
                        onClick={(event) => setState(state => ({...state, endDateAnchor: event.target}))}
                    />
                </Grid>
            </Grid>
        </Grid>
        <Grid container className={classes.center}>
            <LazyListComponent
                key={random}
                itemComponent={itemComponent}
                itemTransform={itemTransform}
                noItemsComponent={<ActivityItemComponent label={"No errors found"}/>}
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
