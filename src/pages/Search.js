import React from "react";
import ModalComponent from "../components/ModalComponent";
import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import Hidden from "@material-ui/core/Hidden";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import {useHistory} from "react-router-dom";
import Toolbar from "@material-ui/core/Toolbar";
import withStyles from "@material-ui/styles/withStyles";
import ClearIcon from "@material-ui/icons/Clear";
import Input from "@material-ui/core/Input";
import {usePages} from "../controllers/General";


const styles = theme => ({
    button: {
        marginRight: theme.spacing(1),
        textTransform: "none"
    },
    messagebox: {
        height: theme.spacing(40),
        width: "100%"
    },
    title: {
        padding: 0
    },
    content: {
        padding: theme.spacing(1),
    },
    searchbar: {
        backgroundColor: theme.palette.primary.main,
        bottom: 0,
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 1,
        [theme.breakpoints.up("md")]: {
            paddingRight: theme.spacing(2),
        },
        [theme.breakpoints.down("sm")]: {
            left: 0,
            paddingRight: theme.spacing(1),
        }
    },
    searchfield: {
        flex: 1,
    }
});

const Search = (props) => {
    const [state, setState] = React.useState({disabled: false});
    return <SearchContent {...props}/>
};

export const SearchModal = ({open, onClose, classes, handleSearch, ...props}) => {
    return <ModalComponent onClose={onClose}>
        <Hidden mdUp>
            <Grid container className={classes.title} alignItems={"center"} justify={"space-between"}>
                <IconButton onClick={() => {
                    onClose();
                }}>
                    <BackIcon/>
                </IconButton>
                <Button onClick={handleSearch} variant={"contained"} color={"secondary"}
                        className={classes.button}>Search</Button>
            </Grid>
        </Hidden>
        <Hidden smDown>
            <DialogTitle id="alert-dialog-title">Reply</DialogTitle>
        </Hidden>
        <DialogContent classes={{root: classes.content}}>
            <Grid container>
                <SearchContent {...props}/>
            </Grid>
        </DialogContent>
        <Hidden smDown>
            <DialogActions>
                <Button onClick={onClose} color={"secondary"}>Cancel</Button>
                <Button onClick={handleSearch} color={"secondary"}>Search</Button>
            </DialogActions>
        </Hidden>

    </ModalComponent>
}

export const SearchContent = () => {
    const history = useHistory();

    const args = new URLSearchParams(history.location.search.replace(/^\?/, ""));
    return <React.Fragment>
        <Grid container>
            Search value: {args.get("q")}
        </Grid>
        <Grid container>
            Search is not yet implemented
        </Grid>
    </React.Fragment>
}

export default withStyles(styles)(Search);

export const SearchToolbar = withStyles(styles)(({classes}) => {
    const pages = usePages();
    const history = useHistory();
    const [state, setState] = React.useState({});
    const {search, searchValue = "", unblock} = state;
    const inputRef = React.useRef();

    const closeSearch = () => {
        setState(state => ({...state, search: false, unblock: null}))
        unblock();
    }

    const handleSearch = () => {
        if (!searchValue) return;
        closeSearch();
        history.push(pages.search.route/*.replace(/\*$/, "?q=")*/ + "?q=" + encodeURIComponent(searchValue));
    }

    if (!search) return <IconButton
        onClick={() => {
            const unblock = history.block(() => {
                setState(state => ({...state, search: false, unblock: null}));
                unblock();
                return false;
            })
            setState({...state, search: true, unblock})
        }}
        title={"Search"}
        variant={"text"}
        children={pages.search.icon}/>

    return <Toolbar className={classes.searchbar}>
        <IconButton
            children={<BackIcon/>}
            color="inherit"
            edge="start"
            onClick={closeSearch}
            title={"Cancel search"}
        />
        <Input autoFocus={true}
               className={classes.searchfield}
               endAdornment={<IconButton
                   children={<ClearIcon/>}
                   onClick={() => {
                       setState({...state, searchValue: ""});
                       inputRef.current && inputRef.current.focus();
                   }}
                   title={"Clear search"}
                   variant={"text"}
               />}
               onChange={evt => {
                   setState({...state, searchValue: evt.currentTarget.value})
               }}
               onKeyUp={evt => {
                   if (evt && evt.key === "Escape") closeSearch();
                   else if (evt && evt.key === "Enter") handleSearch();
               }}
               placeholder={"Search"}
               inputRef={inputRef}
               value={searchValue}
        />
        <IconButton
            children={pages.search.icon}
            onClick={handleSearch}
            title={"Search"}
            variant={"text"}
        />
    </Toolbar>
})
