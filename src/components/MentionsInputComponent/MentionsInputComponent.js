import React from "react";
import {useFirebase} from "../../controllers/General";
import LoadingComponent from "../LoadingComponent";
import styles from "./styles/MentionsInputComponent.module.css";

const MentionsInputComponent = React.lazy(() => import("./LazyMentionsComponent"));

export default props => {
    const firebase = useFirebase();
    return <React.Suspense fallback={<LoadingComponent/>}>
        <MentionsInputComponent
            firebase={firebase}
            {...props}
            className={[
                styles.root,
                props.className,
                props.multiline && styles.multiline
            ].filter(Boolean).join(" ")}
        />
    </React.Suspense>
}
