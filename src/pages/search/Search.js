import React from "react";
import SearchContent from "./SearchContent";
import SearchModal from "./SearchModal";
import SearchToolbar from "./SearchToolbar";

const Search = ({toolbar, content, modal, ...props}) => {
    if (content) return <SearchContent {...props}/>
    if (modal) return <SearchModal {...props}/>
    if (toolbar) return <SearchToolbar {...props}/>

    return <SearchContent {...props}/>
};

export default Search;
