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
        mentions = [mentionTags, mentionUsers],
        text,
        tokens,
    }) => {

    if (text && !tokens) {
        tokens = tokenizeText(text);
    }

    if (!tokens) return null;
    return <>
        {tokens.map((token, index) => {
            const mention = mentions.filter(item => item.type === token.type)[0];
            if (mention) {
                const component = mention.component;
                if (!token.value) return null;
                return <component.type
                    {...component.props}
                    className={[classes.text, classes.link, mention.className, className].join(" ")}
                    disableClick={disableClick}
                    display={mention.displayTransform(token.id, token.value)}
                    id={token.id}
                    key={index}
                    style={mention.style}
                />
            } else if (token.type === "cr") {
                return <p className={[classes.text, className].join(" ")} key={index}/>
            } else {
                return <span
                    key={index}
                    className={[classes.text, className].join(" ")}
                >
                    <Linkify
                        componentDecorator={(decoratedHref, decoratedText, key) => {
                            return <a
                                href={disableClick ? "#" : decoratedHref}
                                className={[classes.text, classes.link].join(" ")}
                                key={key}
                                rel={"noopener noreferrer"}
                                target={"_blank"}
                            >
                                {decoratedText}
                            </a>
                        }}
                        textDecorator={text => {
                            if (text.length > 50) {
                                return text.substr(0, 50) + "...";
                            }
                            return text;
                        }}
                    >{token.value}</Linkify>
                </span>
            }
        })}
    </>
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
