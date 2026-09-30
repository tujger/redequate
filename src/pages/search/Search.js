import React from "react";
import SearchToolbar from "./SearchToolbar";
import SearchModal from "./SearchModal";
import SearchContent from "./SearchContent";

const Search = ({toolbar, content, modal, ...props}) => {
    if (content) return <SearchContent {...props}/>
    if (modal) return <SearchModal {...props}/>
    if (toolbar) return <SearchToolbar {...props}/>

    return <SearchContent {...props}/>
};

export default Search;
