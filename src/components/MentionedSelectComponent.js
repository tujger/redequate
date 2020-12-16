import React from "react";
import {useFirebase} from "../controllers/General";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import notifySnackbar from "../controllers/notifySnackbar";

const MentionedSelectComponent = ({classes = {}, className, mention, onChange, value}) => {
    const firebase = useFirebase();
    const [state, setState] = React.useState({items: []});
    const {items} = state;

    const handleChange = (evt, ...rest) => {
        onChange && onChange(evt, ...rest);
    }

    React.useEffect(() => {
        const {pagination, transform} = mention;
        if (!pagination) return;
        pagination("", firebase).next()
            .then(items => {
                if (transform) {
                    return Promise.all(items.map(async item => transform(item)));
                }
                return items;
            })
            .then(items => {
                setState(state => ({...state, items}));
            })
            .catch(notifySnackbar);
    }, []);

    return <Select
        className={[classes.root, className].join(" ")}
        color={"secondary"}
        displayEmpty={true}
        onChange={handleChange}
        renderValue={value => value || "<Select>"}
        value={value || ""}
    >
        {items.map((item, index) => {
            return <MenuItem key={index} value={item.id}>{item.display}</MenuItem>
        })}
    </Select>
}

export default MentionedSelectComponent;
