import {tokenizeText} from "../MentionedTextComponent";
import {cacheDatas} from "../../controllers/General";

export const PostData = function ({firebase, type = "posts", allowedExtras = ["like"]}) {
    let _id, _uid, _text, _images, _tokens, _created, _extras, _counters, _replyTo, _root;
    const refRoot = firebase.database().ref();

    const _body = {
        get asString() {
            return _body.toString().replace(/\[\d+m/g, "");
        },
        get created() {
            return _created
        },
        get extras() {
            return _extras
        },
        get id() {
            return _id
        },
        get image() {
            return _images ? _images[0] : undefined;
        },
        get images() {
            return _images
        },
        get isRoot() {
            return !_replyTo;
        },
        get replyTo() {
            return _replyTo
        },
        get root() {
            return _root
        },
        set id(id) {
            if (_id && _id !== id) throw new Error("Post id is already defined");
            _id = id;
        },
        get length() {
            if (_tokens) {
                let length = 0;
                for (const token of _tokens) {
                    if (token.value) {
                        length += token.value.length
                    } else {
                        length += token.length;
                    }
                }
                return length;
            }
            return 0;
        },
        get plainText() {
            let text = "";
            if (_tokens) {
                for (const token of _tokens) {
                    if (token.type) {
                        text += token.value
                    } else {
                        text += token;
                    }
                }
            }
            return text;
        },
        get text() {
            return _text
        },
        get tokens() {
            return _tokens
        },
        get uid() {
            return _uid
        },
        counter: type => {
            if (!_counters) throw new Error("Counters not available.");
            return _counters[type] || 0;
        },
        create: ({uid, text, id, created, image, images, replyTo, root}) => {
            _uid = uid;
            _id = id || _id;
            _created = created;
            _text = text;
            _images = images;
            _replyTo = replyTo;
            _root = root;
            if (image) _images = [image];
            _tokens = tokenizeText(text);
            if (_id) cacheDatas.put(_id, _body);
            return _body;
        },
        data: () => {
            const data = {
                uid: _uid,
                text: _text,
                tokens: _tokens
            };
            if (_id) data.id = _id;
            if (_created) data.created = _created;
            if (_images) data.images = _images;
            return data;
        },
        extra: type => {
            if (!_extras || !_extras[type]) {
                return null;
            }
            return !!_extras[type].value;
        },
        fetch: (id) => new Promise((resolve, reject) => {
            if (_id && id && _id !== id) throw new Error(`Post id is already defined: ${id}!=${_id}`);
            _id = id || _id;
            if (!_id) throw new Error("Post id is not defined");
            if (_tokens) {
                resolve(_body);
                return;
            }
            _body._refPosts.child(_id).once("value").then(snapshot => {
                if (snapshot.exists()) {
                    _body._lastSnapshot = snapshot;
                    const data = snapshot.val();
                    data.replyTo = data.to;
                    _body.create(data);
                    _created = data.created;
                    cacheDatas.put(_id, _body);
                    resolve(_body);
                } else {
                    reject(new Error(`Post not found: ${_id}`))
                }
            }).catch(reject)
        }),
        fetchCounters: () => new Promise((resolve, reject) => {
            if (!_id) reject(new Error("Post not submitted yet."));
            _counters = {};
            refRoot.child("_counters").child(_id).once("value").then(snapshot => {
                _counters = snapshot.val() || {};
                resolve(_body);
            })
        }),
        fetchExtras: (uid) => new Promise((resolve, reject) => {
            if (!_id) {
                reject(new Error("Post not submitted yet."));
                return;
            }
            if (!uid) {
                resolve(_body);
                return;
            }
            // eslint-disable-next-line camelcase
            const id_uid = `${_id}_${uid}`;
            _body._refExtra.orderByChild("id_uid").equalTo(id_uid).once("value").then(snapshot => {
                _extras = {};
                snapshot.forEach(child => {
                    if (child.exists()) {
                        const val = child.val();
                        if (allowedExtras.indexOf(val.type) >= 0) {
                            _extras[val.type] = {key: child.key, value: val};
                        }
                    }
                });
                resolve(_body);
            })
        }),
        publish: () => async () => {
            if (!_id) {
                const pub = await _body._refPosts.push(_body._publishData());
                _id = pub.key;
                _created = (await pub.child("created").once("value")).val();
            }
            cacheDatas.put(_id, _body);
            return _body;
        },
        putExtra: async ({type, uid}) => {
            if (!_extras) throw new Error("'postData.fetchExtras(uid)' before put.");
            if (allowedExtras.indexOf(type) < 0) throw new Error(`Extra of type '${type}' is not allowed.`);
            if (!uid) throw new Error(`'uid' is not defined for '${type}'.`);
            if (_extras[type]) throw new Error(`'${type}' is already defined for ${_id}/${uid}.`);

            if (type === "like" && _extras.dislike) {
                await _body.removeExtra({type: "dislike", uid});
            } else if (type === "dislike" && _extras.like) {
                await _body.removeExtra({type: "like", uid});
            }

            // eslint-disable-next-line camelcase
            const id_uid = `${_id}_${uid}`;
            // eslint-disable-next-line camelcase
            const uid_id = `${uid}_${_id}`;
            const value = {
                id: _id,
                id_uid,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                type,
                uid,
                uid_id,
            };

            const snapshot = await _body._refExtra.push(value);
            _extras[type] = {key: snapshot.key, value}
            _counters = _counters || {};
            _counters[type] = (_counters[type] || 0) + 1;
            return _extras[type];
        },
        removeExtra: async ({type, uid}) => {
            if (!_extras) throw new Error("'postData.fetchExtras(uid)' before remove.");
            if (!uid) throw new Error("'uid' is not defined.");

            const extra = _extras[type];
            await _body._refExtra.child(extra.key).set(null);
            delete _extras[type];
            _counters = _counters || {};
            _counters[type] = (_counters[type] || 1) - 1;
            return extra;
        },
        tokensByLength: length => {
            if (length && length !== 0) {
                let currentLength = 0;
                const tokensShown = [];
                for (const token of _tokens) {
                    tokensShown.push(token);
                    currentLength += token.value.length;
                    if (currentLength > length) {
                        if (token.type === "text" || !token.type) {
                            tokensShown.pop();
                            const lastToken = {...token};
                            lastToken.value = lastToken.value.substr(0, lastToken.value.length - (currentLength - length));
                            tokensShown.push(lastToken);
                            tokensShown.push({type: "text", value: "..."});
                        } else if (_tokens.indexOf(token) < _tokens.length - 1) {
                            tokensShown.push({type: "text", value: "..."});
                        }
                        break;
                    }
                }
                return tokensShown;
            } else {
                return _tokens;
            }
        },
        _publishData: () => {
            const value = {
                created: _created || firebase.database.ServerValue.TIMESTAMP,
                text: _text,
                uid: _uid,
                images: _images || null,
                to: _replyTo || null,
                root: _root || null
            };
            return value;
        },
        _refRoot: refRoot,
        _refPosts: refRoot.child(type),
        _refExtra: refRoot.child("extra"),
        _updateVal: async (section, path, change, cache) => {
            path = `${section}/${path}`;
            if (cache[path] !== undefined) {
            } else {
                const count = await _body._refRoot.child(path).once("value");
                cache[path] = count.val() || 0;
            }
            cache[path] = cache[path] + change;
            return cache[path];
        },
        _updateCounter: (path, change, cache) => {
            return _body._updateVal("_counters", path, change, cache);
        },
        // updateTokens: tokens => {
        //     _tokens = tokens || [];
        //     _text = _tokens.map(token => {
        //         if (token.type === "cr") {
        //             return "\n";
        //         } else if (token.type === "text") {
        //             return token.value;
        //         } else if (token.type) {
        //             return `$[${token.type}:${token.id}:${token.value}]`;
        //         } else {
        //             return token;
        //         }
        //     }).join("");
        // },
        toString: () => {
            return `[PostData] id: \x1b[34m${
                _id}\x1b[30m, uid: \x1b[34m${
                _uid}\x1b[30m, ${
                _replyTo ? `replyTo: \x1b[34m${_replyTo}\x1b[30m, ` : ""}${
                _root ? `root: \x1b[34m${_root}\x1b[30m, ` : ""}${
                _images ? `images: \x1b[34m${JSON.stringify(_images)}\x1b[30m, ` : ""}${
                _tokens.length} tokens: ${_text.substr(0, 30)}${_text.length > 30 ? "..." : ""}`
        },
    }
    return _body;
}
PostData.Unit = {
    HOUR: "HOUR",
    DAY: "DAY",
    MONTH: "MONTH",
    YEAR: "YEAR",
}

export default PostData;

export const dateIndexes = date => {
    const byYear = "" + date.getUTCFullYear();
    const byMonth = byYear + fix(date.getUTCMonth() + 1);
    const byDay = byMonth + fix(date.getUTCDate());
    const byHour = byDay + fix(date.getUTCHours());
    return {
        year: byYear,
        month: byMonth,
        day: byDay,
        hour: byHour,
    }
}

const fix = (t, len = 2) => {
    t = "" + t;
    while (t.length < len) {
        t = "0" + t;
    }
    return t;
}

const fixedDate = (date, rightUnit) => {
    let value = "" + date.getUTCFullYear();
    if (rightUnit === PostData.Unit.YEAR) return value;
    value += fix(date.getUTCMonth() + 1);
    if (rightUnit === PostData.Unit.MONTH) return value;
    value += fix(date.getUTCDate());
    if (rightUnit === PostData.Unit.DAY) return value;
    value += fix(date.getUTCHours());
    if (rightUnit === PostData.Unit.HOUR) return value;
    value += fix(date.getUTCMinutes());
    return value;
}

export const rangeIndexes = (count, unit) => {
    let now = new Date();
    const indexes = [];
    let diff = 1000 * 60 * 60;
    if (unit !== PostData.Unit.HOUR) {
        diff *= 30;
        if (unit !== PostData.Unit.DAY) {
            diff *= 12;
        }
    }
    while (indexes.length < count) {
        indexes.push(fixedDate(now, unit));
        now = new Date(now.getTime() - diff);
    }
    return indexes;
}
