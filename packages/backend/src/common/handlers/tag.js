import {normalizeSortName} from "../../../../common";
import BackendListener from "../BackendListener";

export default class ExtraListener extends BackendListener {
    constructor(backend) {
        super(["tag", "tag_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Tag]", `created [${params.tag_id}]`, {params, value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Tag]", `deleted [${params.tag_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Tag]", `updated [${params.tag_id}]`, {params, previous, value});
    }
}


const pattern = /(\$\[.*?])/g;

export const tokenize = (text = "") => {
    let tokens = text.split(pattern);
    tokens = tokens.map(token => {
        return token.match(/\$\[(\w+):(.*?):(.*)]/) || [token || ""];
    }).filter(matches => {
        return matches.length > 1 || matches[0].length > 0;
    }).map((matches, index) => {
        if (matches && matches.length > 2 && matches[1] === "tag") {
            return {type: matches[1], id: matches[2], value: matches[3], index: index}
        } else {
            return {type: "text", id: null, value: matches[0], index: index};
        }
    });
    return tokens;
}

export const parseTokens = async props => {
    const {text} = props;
    const tokens = tokenize(text);
    return {...props, tokens};
}

export const filterTagTokens = async props => {
    const {tokens = []} = props;
    const tags = tokens.filter(token => token.type === "tag");
    return {...props, tokens: tags};
}

export const fetchExistingTags = async props => {
    const {backend, tokens} = props;
    if(!tokens.length) {
        return {...props, tags: []};
    }
    const cursor = await backend.request("database.cursor", tokens.map(token => ({
        equalTo: normalizeSortName(token.id),
        group: "-",
        orderBy: ["id"],
        path: ["tag", "tag_id"],
    })));
    const tags = (await cursor.next(1)).filter(({key}) => key !== "-");
    return {...props, tags};
}
