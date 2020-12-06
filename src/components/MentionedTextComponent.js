import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Linkify from "react-linkify";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import {styles} from "../controllers/Theme";

const MentionedTextComponent = (
    {
        classes = {text: "", link: ""},
        className = "",
        disableClick,
        maxLength,
        mentions = [mentionTags, mentionUsers],
        text,
        tokens,
    }) => {

    if (text && !tokens) {
        tokens = tokenizeText(text);
    }

    if (!tokens) return null;

    let length = 0;

    return <span className={[classes.text, className].join(" ")}>
        {tokens.map((token, index) => {
            if (maxLength && length > maxLength) return null;
            const mention = mentions.filter(item => item.type === token.type)[0];
            if (mention) {
                const component = mention.component;
                if (!token.value) return null;
                const text = mention.displayTransform(token.id, token.value);
                length += text.length;
                return <component.type
                    {...component.props}
                    className={[classes.link, mention.className].join(" ")}
                    disableClick={disableClick}
                    display={text}
                    id={token.id}
                    key={index}
                    style={mention.style}
                />
            } else if (token.type === "cr") {
                if (maxLength && length > maxLength) return null;
                return <br key={index}/>
            } else {
                if (maxLength && length > maxLength) return null;
                let text = token.value;
                length += text.length;
                let disable = false;
                if (maxLength && length > maxLength) {
                    text = text.substr(0, text.length - (length - maxLength)) + "...";
                    disable = true;
                }
                return <span
                    key={index}
                >
                    <Linkify
                        componentDecorator={(decoratedHref, decoratedText, key) => {
                            if (disable || disableClick) {
                                return <span
                                    className={classes.link}
                                    key={key}
                                >
                                    {decoratedText}
                                </span>
                            } else {
                                return <a
                                    href={(disable || disableClick) ? "#" : decoratedHref}
                                    className={classes.link}
                                    key={key}
                                    rel={"noopener noreferrer"}
                                    target={"_blank"}
                                >
                                    {decoratedText}
                                </a>
                            }
                        }}
                    >{text}</Linkify>
                </span>
            }
        })}
    </span>
}

export default withStyles(styles)(MentionedTextComponent);

const pattern = new RegExp(/((?:\$\[.*?])|(?:[\r\n]+))/g);

export const tokenizeText = (text = "") => {
    let tokens = text.split(pattern);
    tokens = tokens
        .map(token => token.match(/\$\[(\w+):(.*?):(.*)]/) || [token || ""])
        .filter(matches => matches.length > 1 || matches[0].length > 0)
        .map((matches, index) =>
            (matches.length === 1 && matches[0].match(/^[\r\n]+$/))
                ? {type: "cr", value: " ", index: index} : matches)
        .map((matches, index) =>
            matches.length > 2 ?
                {type: matches[1], id: matches[2], value: matches[3], index: index} : matches)
        .map((matches, index) =>
            matches.length === 1 ? {type: "text", value: matches[0], index} : matches)
    return tokens;
}
