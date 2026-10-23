/** The database portion of publishing a root post and returning to Discover. */
export async function discoverPostScenario(database, collection = "posts") {
    const firstKey = await database.create([collection, "post_id"], {
        created: database.TIMESTAMP, images: null, to: 0, text: "first", uid: "author"
    });
    const firstRead = await database.read([collection, {post_id: firstKey}]);
    const options = {orderBy: ["to"], equalTo: 0, order: "desc"};
    const firstCursor = database.cursor([collection, "post_id"], options);
    const firstPage = await firstCursor.next(10);

    const replyKey = await database.create([collection, "post_id"], {
        created: database.TIMESTAMP, to: firstKey, text: "reply", uid: "author"
    });
    const secondKey = await database.create([collection, "post_id"], {
        created: database.TIMESTAMP, to: 0, text: "second", uid: "author"
    });
    const secondRead = await database.read([collection, {post_id: secondKey}]);
    // Returning from the post page mounts Discover with a new cursor.
    const returnedCursor = database.cursor([collection, "post_id"], options);
    const returnedPage = await returnedCursor.next(10);

    expect(typeof firstKey).toBe("string");
    expect(firstRead).toMatchObject({to: 0, text: "first", uid: "author"});
    expect(typeof firstRead.to).toBe("number");
    expect(firstPage.map(entry => entry.key)).toEqual([firstKey]);
    expect(firstPage[0].value).toMatchObject({to: 0, text: "first"});
    expect(secondRead).toMatchObject({to: 0, text: "second"});
    expect(typeof secondRead.to).toBe("number");
    expect(returnedCursor).not.toBe(firstCursor);
    expect(returnedPage.map(entry => entry.key)).toEqual([secondKey, firstKey]);
    expect(returnedPage.every(entry => entry.value.to === 0)).toBe(true);
    expect(returnedPage.map(entry => entry.key)).not.toContain(replyKey);
}
