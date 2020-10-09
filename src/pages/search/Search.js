import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import SearchToolbar from "./SearchToolbar";
import SearchModal from "./SearchModal";
import SearchContent from "./SearchContent";
import {styles} from "../../controllers/Theme";

const Search = ({toolbar, content, modal, ...props}) => {
    if (content) return <SearchContent {...props}/>
    if (modal) return <SearchModal {...props}/>
    if (toolbar) return <SearchToolbar {...props}/>

    return <SearchContent {...props}/>
};

export default withStyles(styles)(Search);
