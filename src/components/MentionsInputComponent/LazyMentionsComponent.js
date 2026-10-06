import React from "react";
import {Mention, MentionsInput} from "react-mentions";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/MentionsInputComponent.module.css";

const LazyMentionsComponent = ({
    autoFocus,
    className,
    disabled,
    firebase,
    fullWidth = true,
    inputRef,
    label,
    mentionsParams = [],
    multiline = false,
    onApply,
    onChange,
    onKeyUp,
    onSelect,
    placeholder,
    required,
    value = ""
}) => {
    const onSuggestionPointerDown = useRippleEffect();
    const handleChange = (event, nextValue, plainValue, mentions) => {
        onChange?.(event, nextValue, plainValue, mentions);
        if (mentions.length) onSelect?.(event, nextValue, plainValue, mentions);
    };

    const handleKeyUp = event => {
        if (event.key === "Enter" && !multiline) onApply?.(value);
        onKeyUp?.(event);
    };

    return <div className={[styles.field, fullWidth && styles.fullWidth, className].filter(Boolean).join(" ")}>
        {label && <span className={styles.label}>{label}{required ? " *" : ""}</span>}
        <MentionsInput
            allowSuggestionsAboveCursor
            aria-label={label}
            autoFocus={autoFocus}
            disabled={disabled}
            inputRef={inputRef}
            onChange={handleChange}
            onKeyUp={handleKeyUp}
            placeholder={placeholder}
            singleLine={!multiline}
            value={value || ""}
        >
            {mentionsParams.map((mention, index) => <Mention
                key={mention.type || index}
                className={mention.className}
                data={(query, callback) => {
                    if (!query || !mention.pagination) {
                        callback([]);
                        return;
                    }
                    mention.pagination(query, firebase).next()
                        .then(items => Promise.all(items.map(item => mention.transform ? mention.transform(item) : item)))
                        .then(callback)
                        .catch(() => callback([]));
                }}
                displayTransform={mention.displayTransform}
                markup={mention.markup}
                renderSuggestion={(entry, search, highlighted, index, focused) => <span
                    className={[styles.suggestion, focused && styles.suggestionFocused].filter(Boolean).join(" ")}
                    onPointerDown={onSuggestionPointerDown}
                >{entry.display}</span>}
                trigger={mention.trigger}
            />)}
        </MentionsInput>
    </div>;
};

export default LazyMentionsComponent;
