import React from "react";
import LoadingComponent from "../LoadingComponent";
import {useFirebase} from "../../controllers/General";

const MentionsInputComponent = React.lazy(() => import("./LazyMentionsComponent"));

export default props => {
    const firebase = useFirebase();
    return <React.Suspense fallback={<LoadingComponent/>}>
        <MentionsInputComponent firebase={firebase} {...props}/>
    </React.Suspense>
}
