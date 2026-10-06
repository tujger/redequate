import SendIcon from "@material-ui/icons/Send";
import React from "react";
import {useWindowData} from "../controllers";
import inputStyles from "./styles/ChatInputBox.module.css";

export default React.forwardRef(({className, inputComponent, style = {}, onSend}, ref) => {
    const windowData = useWindowData()
    const [state, setState] = React.useState({value: ""});
    const {value} = state;

    const handleChange = evt => {
        setState({...state, value: evt.target.value});
    }

    const handleSend = () => {
        if (!value) return;
        onSend(value);
        setState({...state, value: ""})
    }

    return <div ref={ref} className={[className, inputStyles.messageBox].filter(Boolean).join(" ")} style={style}>
        <div className={inputStyles.inputField}>
            <inputComponent.type
                {...inputComponent.props}
                autofocus={!windowData.isNarrow()}
                color={"secondary"}
                fullWidth
                onChange={handleChange}
                onKeyUp={event => {
                    if (event.key === "Enter" /* && event.ctrlKey */) {
                        handleSend();
                    } else if (event && event.key === "Escape") {
                        handleChange({target: {value: ""}});
                        setState(state => ({...state, value: ""}));
                    }
                }}
                value={value}
            />
        </div>
        <div
            aria-label={"send message"}
            className={inputStyles.sendButton}
            onClick={handleSend}
            onKeyDown={event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                handleSend();
            }}
            role='button'
            tabIndex={0}
        >
            <SendIcon/>
        </div>
    </div>
})
