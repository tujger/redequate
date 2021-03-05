import React from "react";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import notifySnackbar from "../controllers/notifySnackbar";
import {tokenizeText} from "./MentionedTextComponent";
import MentionsInputComponent from "./MentionsInputComponent/MentionsInputComponent";
import {useFirebase} from "../controllers/General";

const MentionedSelectComponent = (
    {
        classes = {},
        className,
        combobox,
        disabled,
        label,
        mention,
        onChange,
        placeholder,
        value = ""
    }) => {
    const firebase = useFirebase();
    const [state, setState] = React.useState({items: [], input: value});
    const {items, selected = "", input} = state;

    const handleSelect = (evt, ...rest) => {
        const selected = items.filter(item => item.id === evt.target.value)[0];
        let token = null, value = evt.target.value;
        if (selected) {
            token = {
                ...selected,
                type: mention.type
            };
            if (mention.markup) {
                value = mention.markup.replace("__id__", token.id).replace("__display__", token.display);
            }
            // setState(state => ({...state, selected: token.id}))
        }
        onChange && onChange(evt, value, token, ...rest);
    }

    const handleInput = (evt, mentioned, plain, tokens, ...rest) => {
        let token = null, value = evt.target.value;
        if (tokens && tokens.length) {
            token = tokens[tokens.length - 1];
            token = {
                ...token,
                type: mention.type
            };
            value = mention.markup.replace("__id__", token.id).replace("__display__", token.display);
            onChange && onChange(evt, value, token, ...rest);
        } else if (!value) {
            onChange && onChange(evt, value, null, ...rest);
        }
        setState(state => ({...state, input: value}))
    }

    React.useLayoutEffect(() => {
        const importValues = async () => {
            if (!mention) throw Error("Mention is not defined");
            const {pagination, transform} = mention;
            return {pagination, transform, value};
        }
        const checkIfValuesValid = async props => {
            const {pagination} = props;
            if (!pagination) throw "skip";
            return props;
        }
        const fetchItems = async props => {
            const {pagination} = props;
            const items = await pagination("", firebase).next();
            return {...props, items};
        }
        const transformItems = async props => {
            const {items, transform} = props;
            if (transform) {
                const transformedItems = await Promise.all(items.map(async item => transform(item)));
                return {...props, items: transformedItems};
            }
            return props;
        }
        const extractSelected = async props => {
            const {value} = props;
            const token = tokenizeText(value)[0];
            return {...props, selected: (token ? token.id : value) || "", input: value};
        }
        const updateState = async props => {
            const {items, selected, input} = props;
            setState(state => ({...state, items, selected, input}));
        }
        const catchEvent = async event => {
            if (event instanceof Error) throw event;
            console.warn(event);
        }

        importValues()
            .then(checkIfValuesValid)
            .then(fetchItems)
            .then(transformItems)
            .then(extractSelected)
            .then(updateState)
            .catch(catchEvent)
            .catch(notifySnackbar);
    }, [value]);

    if (combobox) {
        return <MentionsInputComponent
            color={"secondary"}
            disabled={disabled}
            fullWidth
            label={label}
            mentionsParams={[mention]}
            onApply={(value) => console.log(value)}
            onChange={handleInput}
            placeholder={placeholder}
            value={input || ""}
        />
    }

    const Wrapper = ({children}) => {
        if (label) {
            return <FormControl
                fullWidth
            >
                <InputLabel>{label}</InputLabel>
                {children}
            </FormControl>
        }
        return children;
    }

    return <Wrapper>
        <Select
            className={[classes.root, className].join(" ")}
            color={"secondary"}
            disabled={disabled}
            displayEmpty={!label}
            onChange={handleSelect}
            value={selected}
        >
            <MenuItem value={""}><em>{placeholder || "<Select>"}</em></MenuItem>
            {items.map((item, index) => {
                return <MenuItem key={index} value={item.id}>{item.display}</MenuItem>
            })}
        </Select>
    </Wrapper>
}

export default MentionedSelectComponent;
