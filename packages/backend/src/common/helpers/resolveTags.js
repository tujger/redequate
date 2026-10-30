import {normalizeSortName} from "../../../../common";

export default ({backend, text, createIfAbsent}) => {
    return parseTokens({backend, text, createIfAbsent})
        .then(filterTagTokens)
        .then(fetchExistingTags)
        .then(createTagsIfAbsent)
        .then(extractTags);
};

const pattern = /(\$\[.*?])/g;

const tokenize = (text = "") => {
    let tokens = text.split(pattern);
    tokens = tokens.map(token => {
        return token.match(/\$\[(\w+):(.*?):(.*)]/) || [token || ""];
    }).filter(matches => {
        return matches.length > 1 || matches[0].length > 0;
    }).map((matches, index) => {
        if (matches && matches.length > 2 && matches[1] === "tag") {
            return {type: matches[1], id: normalizeSortName(matches[2]), value: matches[3], index: index}
        } else {
            return {type: "text", id: null, value: matches[0], index: index};
        }
    });
    return tokens;
}

const parseTokens = async props => {
    const {text} = props;
    const tokens = tokenize(text);
    return {...props, tokens};
}

const filterTagTokens = async props => {
    const {tokens = []} = props;
    const tags = tokens.filter(token => token.type === "tag");
    return {...props, tokens: tags};
}

const fetchExistingTags = async props => {
    const {backend, tokens} = props;
    if (!tokens.length) {
        return {...props, tags: []};
    }
    const cursor = await backend.request("database.cursor", tokens.map(token => ({
        equalTo: token.id,
        group: "-",
        orderBy: ["id"],
        path: ["tag", "tag_id"],
    })));
    const tags = (await cursor.next(1)).filter(({key}) => key !== "-");
    return {...props, tags};
}
const createTagsIfAbsent = async props => {
    const {backend, createIfAbsent, tags, tokens} = props;
    if (!createIfAbsent) return props;

    const absent = tokens
        .reduce((acc, token) => {
            if (!acc.find(t => t.id === token.id)) {
                acc.push(token);
            }
            return acc;
        }, [])
        .filter(token => !tags.find(t => t.value.id === token.id));

    const promises = absent.map(token => backend.request("database.create", ["tag", "tag_id"], {
        id: token.id,
        label: token.value,
        timestamp: backend.TIMESTAMP,
        uid: "0",
        _sort_name: token.id,
    }).then(async key => {
        const value = await backend.request("database.read", ["tag", {tag_id: key}]);
        return {key, value}
    }));

    const added = await Promise.all(promises);
    const updatedTags = [...tags, ...added];
    return {...props, tags: updatedTags};
}
const extractTags = props => {
    return props.tags;
}
