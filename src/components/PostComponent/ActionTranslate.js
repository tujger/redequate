import React from "react";
import IconButton from "@material-ui/core/IconButton";
import TranslateIcon from "@material-ui/icons/Translate";
import Grid from "@material-ui/core/Grid";
import {useTextTranslation} from "../../controllers/textTranslation";
import {notifySnackbar} from "../../controllers";

export default ({icon = true, postData, userData, mentions, onComplete, UploadProps}) => {
    const textTranslation = useTextTranslation();
    const [state, setState] = React.useState({});
    const {show} = state;

    const handleClick = evt => {
        evt.stopPropagation();
        textTranslation.detectLanguage(postData.text)
            .then(language => textTranslation.translateTo({text: postData.text, source: language, target: "ru"}))
            .then(console.log)
            .catch(notifySnackbar);
    }

    React.useEffect(() => {
        return;
        console.log(textTranslation);
        if (!textTranslation.isAvailable()) return;
        setState(state => ({...state, show: true}));

    }, [])

    if (!show) return null;
    return <Grid item>
        <IconButton
            aria-label={"Translate"}
            children={<TranslateIcon/>}
            component={"div"}
            onClick={handleClick}
            size={"small"}
            title={"Translate"}
        />
    </Grid>
}
