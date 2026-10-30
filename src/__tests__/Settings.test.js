import React, {act} from "react";
import {vi} from "vitest";
import {getByLabelText, getByText} from "@testing-library/dom";
import Settings from "../pages/admin/Settings";
import {render, unmount} from "./render";

const context = vi.hoisted(() => ({database: {}, settings: {}, dispatch: vi.fn()}));
vi.mock("react-redux", () => ({useDispatch: () => context.dispatch}));
vi.mock("react-router-dom", () => ({useHistory: () => ({goBack: vi.fn()})}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value}), getI18n: () => undefined}));
vi.mock("../controllers", () => ({useDatabase: () => context.database, useRedirectToLogin: () => false}));
vi.mock("../controllers/General", () => ({useMetaInfo: () => ({}), useWindowData: () => ({isNarrow: () => false})}));
vi.mock("../controllers/useCurrentUserData", () => ({useCurrentUserDataValue: () => ({id: "admin"})}));
vi.mock("../controllers/mentionTypes", () => ({mentionUsers: []}));
vi.mock("../controllers/notifySnackbar", () => ({default: vi.fn()}));
vi.mock("../controllers/UserData", () => ({default: class { async fetch() { return {name: "Support"}; } }}));
vi.mock("../components/MentionedTextComponent", () => ({tokenizeText: () => [{type: "user", id: "support"}]}));
vi.mock("../components/MentionedSelectComponent", () => ({default: () => null}));
vi.mock("../components/ProgressView", () => ({default: {SHOW: "show", HIDE: "hide"}}));
vi.mock("../components/ConfirmComponent", () => ({default: () => null}));
vi.mock("../pages/admin/audit/auditReducer", () => ({updateActivity: vi.fn()}));
vi.mock("../controls/Tabs/Tabs", () => ({default: ({items, onChange}) => <nav>{items.map(item =>
    <button key={item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</nav>}));
vi.mock("../controls/Switch/Switch", () => ({default: ({checked, disabled, onChange}) =>
    <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={event => onChange(event, event.target.checked)}/>}));
vi.mock("../controls/Button/Button", () => ({default: ({children, disabled, onClick}) => <button disabled={disabled} onClick={onClick}>{children}</button>}));
vi.mock("../controls/TextField/TextField", () => ({default: () => null}));
vi.mock("../controls/Select/Select", () => ({default: () => null}));
let container;
beforeEach(() => {
    container = document.createElement("div");
    context.settings = {uploadsAllow: true};
    context.database = {
        read: vi.fn(async path => path[1].settings ? context.settings : path[1].support ? "support" : null),
        update: vi.fn(async updates => {
            for (const [path, value] of updates) if (path[1] === "settings") context.settings = value;
        }),
    };
});
afterEach(() => unmount(container));
const click = async label => act(async () => getByText(container, label, {selector: "button"}).click());
const start = async () => {
    await act(async () => render(<Settings uploadable={["audio/*", "images/*", "video/*"]}/>, container));
    await click("Uploads");
};
const toggle = async type => act(async () => getByLabelText(container, `Allow ${type}`).click());

it.each([null, undefined, "invalid", {}])("loads safely with uploadsTypes %j", async uploadsTypes => {
    if (uploadsTypes !== undefined) context.settings.uploadsTypes = uploadsTypes;
    await start();
    for (const type of ["audio/*", "images/*", "video/*"]) expect(getByLabelText(container, `Allow ${type}`).checked).toBe(false);
});
it("renders an existing selection and keeps it when saving other settings", async () => {
    context.settings.uploadsTypes = ["images/*", "application/pdf"];
    await start();
    expect(getByLabelText(container, "Allow images/*").checked).toBe(true);
    await click("Save");
    expect(context.settings.uploadsTypes).toEqual(["images/*", "application/pdf"]);
});
it("adds and removes selected types and restores them after reopening", async () => {
    context.settings.uploadsTypes = ["application/pdf"];
    await start();
    await toggle("audio/*"); await toggle("images/*"); await toggle("audio/*"); await toggle("audio/*");
    expect(getByLabelText(container, "Allow audio/*").checked).toBe(true);
    await click("Save");
    expect(context.settings.uploadsTypes).toEqual(["application/pdf", "images/*", "audio/*"]);
    unmount(container);
    await start();
    expect(getByLabelText(container, "Allow audio/*").checked).toBe(true);
    expect(getByLabelText(container, "Allow images/*").checked).toBe(true);
    expect(getByLabelText(container, "Allow video/*").checked).toBe(false);
});
it("saves an emptied selection as null and reopens it without crashing", async () => {
    context.settings.uploadsTypes = ["video/*"];
    await start(); await toggle("video/*"); await click("Save");
    expect(context.settings.uploadsTypes).toBeNull();
    unmount(container); await start();
    expect(getByLabelText(container, "Allow video/*").checked).toBe(false);
});
