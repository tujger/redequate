import React from "react";
import LoadingComponent from "../LoadingComponent";
import styles from "./styles/MentionsInputComponent.module.css";

const MentionsInputComponent = React.lazy(() => import("./LazyMentionsComponent"));

export default props => {
    return <React.Suspense fallback={<LoadingComponent/>}>
        <MentionsInputComponent
            {...props}
            className={[
                styles.root,
                props.className,
                props.multiline && styles.multiline
            ].filter(Boolean).join(" ")}
        />
    </React.Suspense>
}
