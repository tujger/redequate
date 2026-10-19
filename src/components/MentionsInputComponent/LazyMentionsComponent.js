import React from "react";
import {Mention, MentionsInput} from "react-mentions";
import {useDatabase} from "../../controllers";
import useRippleEffect from "../../helpers/useRippleEffect";
import styles from "./styles/MentionsInputComponent.module.css";

export default (
    {
        autoFocus,
        className,
        disabled,
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
    const database = useDatabase();
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
            classNames={{mentions__suggestions: styles.suggestions}}
            disabled={disabled}
            inputRef={inputRef}
            onChange={handleChange}
            onKeyUp={handleKeyUp}
            placeholder={placeholder}
            singleLine={!multiline}
            style={{suggestions: {zIndex: 1301}}}
            suggestionsPortalHost={typeof document === "undefined" ? undefined : document.body}
            value={value || ""}
        >
            {mentionsParams.map((mention, index) => <Mention
                key={mention.type || index}
                className={mention.className}
                data={(query, callback) => {
                    if (!query || !mention.cursor) {
                        callback([]);
                        return;
                    }
                    mention.cursor(query, database).next(10)
                        .then(items => Promise.all(items.map(item => mention.transform ? mention.transform(item) : item)))
                        .then(callback)
                        .catch(() => callback([]));
                }}
                displayTransform={mention.displayTransform}
                markup={mention.markup}
                renderSuggestion={(entry, search, highlighted, index, focused) => {
                    console.log(entry)
                    return <span
                        className={[
                            styles.suggestion,
                            focused && entry.id !== entry.display && styles.suggestionFocused,
                            entry.id === entry.display && styles.group
                        ].filter(Boolean).join(" ")}
                        onPointerDown={onSuggestionPointerDown}
                    >{entry.display}</span>;
                }}
                trigger={mention.trigger}
            />)}
        </MentionsInput>
    </div>;
};
