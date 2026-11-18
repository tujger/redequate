import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import ProfileSubscriptions from '../../../components/ProfileComponent/ProfileSubscriptions';
import mine from '../../../components/ProfileComponent/mutual/_my';
import watching from '../../../components/ProfileComponent/mutual/watching';
import following from '../../../components/ProfileComponent/mutual/following';
const context = vi.hoisted(() => ({user: {id: 'user'}, database: {}, counts: new Map(), subscriptions: new Map()}));
vi.mock('react-i18next', () => ({useTranslation: () => ({t: x => x})}));
vi.mock('../../../controllers', () => ({useCurrentUserDataValue: () => context.user, useDatabase: () => context.database,
    useMetaInfo: () => ({settings: {userProfileFollowing: true}}), useRedirectToLogin: () => false,
    matchRole: () => false, UserRole: {ADMIN: 'admin'}}));
vi.mock('../../../controllers/counterControl', () => ({default: ({path, onchange}) => {
    const key = JSON.stringify(path);
    context.subscriptions.set(key, onchange);
    onchange(context.counts.get(key) || 0);
    return () => context.subscriptions.delete(key);
}}));
vi.mock('../../../components/ProfileComponent/mutual/MutualListWithItems', () => ({default: () => null}));
vi.mock('../../../components/ProfileComponent/mutual/MutualListWithPosts', () => ({default: () => null}));
vi.mock('../../../controls/Tabs/Tabs', () => ({default: ({items, onChange}) => <>{items.map(item =>
    <button key={item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</>}));
let root, container;
const definitions = [mine.listComponents.self, watching.listComponents.subscribes,
    following.listComponents.subscribes, following.listComponents.subscribers];
const paths = [
    [{id:'user'}, 'mutualstamps', {mutual_type:'_my'}],
    [{id:'user'}, 'mutual', {mutual_type:'watching'}],
    [{id:'user'}, 'mutual', {mutual_type:'following'}],
    [{id:'user'}, 'mutual', {mutual_type:'following_s'}],
];
beforeEach(() => {context.counts.clear(); context.subscriptions.clear();container=document.createElement('div');root=createRoot(container);});
afterEach(async () => {await act(async () => root.unmount());expect(context.subscriptions.size).toBe(0);});
it.each([0,1,2,3])('keeps tab %s selected while active and inactive live labels update', async selected => {
    const fields = Object.fromEntries(definitions.map((definition,index) => [index, {listComponents: {
        selected: {...definition, List: () => <div data-testid="list">{index}</div>},
    }}]));
    await act(async () => root.render(<ProfileSubscriptions userData={context.user} publicFields={fields}/>));
    await act(async () => container.querySelectorAll('button')[selected].click());
    expect(container.querySelector('[data-testid="list"]').textContent).toBe(String(selected));
    const change = async (index,value) => {
        const key=JSON.stringify(paths[index]);context.counts.set(key,value);
        await act(async () => context.subscriptions.get(key)(value));
    };
    await change((selected+1)%4,1);
    await change(selected,2);
    await change(selected,2);
    expect(container.querySelector('[data-testid="list"]').textContent).toBe(String(selected));
    expect(container.querySelectorAll('button')[selected].textContent).toContain('(2)');
    expect(context.subscriptions.size).toBe(4);
});
