import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Linkify from "react-linkify";
import {mentionUsers} from "../controllers/mentionTypes";
import {styles} from "../controllers/Theme";

const MentionedTextComponent = (
    {
        tokens,
        classes = {text: "", link: ""},
        className = "",
        mentions = [mentionUsers()]
    }) => {

    return <>
        {tokens.map((token, index) => {
            const mention = mentions.filter(item => item.type === token.type)[0];
            if (mention) {
                const component = mention.component;
                return <component.type
                    className={[classes.text, className].join(" ")}
                    display={token.value}
                    id={token.id}
                    key={index}
                />
            } else if (token.type === "cr") {
                return <p className={[classes.text, className].join(" ")} key={index}/>
            } else {
                return <span key={index} className={[classes.text, className].join(" ")}><Linkify
                    componentDecorator={(decoratedHref, decoratedText, key) => {
                        return <a href={decoratedHref}
                                  className={classes.link}
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
                >{token.value}</Linkify></span>
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
