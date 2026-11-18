import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import watching from '../../../components/ProfileComponent/mutual/watching';
const context = vi.hoisted(() => ({database: {read: vi.fn()}, props: null}));
vi.mock('../../../controllers/AppContext/useDatabase', () => ({default: () => context.database}));
vi.mock('../../../components/ProfileComponent/mutual/MutualListWithItems', () => ({default: props => {context.props = props; return null;}}));
vi.mock('../../../components/ProfileComponent/mutual/MutualListWithPosts', () => ({default: () => null}));
const user = {id: 'same-user'};
const subscription = {key: 'subscription-1', value: {id: 'group-1', type: 'tag', uid: user.id}};
let root;
beforeEach(async () => {
    context.database.read.mockReset();
    root = createRoot(document.createElement('div'));
    const List = watching.listComponents.subscribes.List;
    await act(async () => root.render(<List userData={user}/>));
});
afterEach(async () => {await act(async () => root.unmount());});
it('loads group presentation from its entity store and preserves the relationship', async () => {
    context.database.read.mockResolvedValue({label: 'Group', image: 'group.png'});
    const result = await context.props.itemTransform(subscription);
    expect(context.database.read).toHaveBeenCalledExactlyOnceWith(['tag', {tag_id: 'group-1'}]);
    expect(result).toEqual({...subscription, userData: {name: 'Group', image: 'group.png', initials: 'Group'}});
    expect(subscription.value).toEqual({id: 'group-1', type: 'tag', uid: user.id});
});
it('returns undefined when the referenced group is absent', async () => {
    context.database.read.mockResolvedValue(undefined);
    expect(await context.props.itemTransform(subscription)).toBeUndefined();
});
it('propagates an entity-read failure instead of reporting a missing group', async () => {
    const error = new Error('group read denied');
    context.database.read.mockRejectedValue(error);
    await expect(context.props.itemTransform(subscription)).rejects.toBe(error);
});
it('uses the documented empty image fallback', async () => {
    context.database.read.mockResolvedValue({label: 'Without image'});
    expect((await context.props.itemTransform(subscription)).userData).toEqual({name: 'Without image', initials: 'Without image', image: ''});
});
