import React from "react";
import LoadingComponent from "../LoadingComponent";
const MentionsComponent = React.lazy(() => import("./LazyMentionsComponent"));

export default props => <React.Suspense fallback={<LoadingComponent/>}>
    <MentionsComponent {...props}/>
</React.Suspense>
