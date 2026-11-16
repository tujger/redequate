import FirebaseDatabase from "../../firebase";
import {baseRules, resolveRules} from "../../firebase/rules.mjs";

test("Firebase provider resolves declarative options without using its Firebase context", () => {
    const rules = {additions: {posts: {".indexOn": ["created"]}}};
    const database = new FirebaseDatabase({firebase: undefined, rules});
    expect(database.rules).toEqual(resolveRules(baseRules, rules));
    expect(new FirebaseDatabase({firebase: undefined}).rules).toEqual(baseRules);
    expect(() => new FirebaseDatabase({rules: {additions: {posts: {".read": false}}}})).toThrow(/conflict/);
});
