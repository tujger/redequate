import BackendListener from "../common/BackendListener";
import {extra as ExtraListener, post as PostListener} from "../common/handlers";

it("stores the path and leaves unimplemented events absent", () => {
    class CreateOnly extends BackendListener {
        constructor(backend) { super(["items", "item_id"], backend); }
        onCreate() {}
    }
    const listener = new CreateOnly({});
    expect(listener.path).toEqual(["items", "item_id"]);
    expect(listener.onCreate).toBeInstanceOf(Function);
    expect(listener.onUpdate).toBeUndefined();
    expect(listener.onDelete).toBeUndefined();
    expect(listener.onWrite).toBeUndefined();
});

it.each([[ExtraListener, ["extra", "extra_id"]], [PostListener, ["posts", "post_id"]]])(
    "constructs a listener at %j", (Listener, path) => {
        const listener = new Listener({});
        expect(listener).toBeInstanceOf(BackendListener);
        expect(listener.path).toEqual(path);
        for (const name of ["onCreate", "onUpdate", "onDelete"]) expect(listener[name]).toBeInstanceOf(Function);
        expect(listener.onWrite).toBeUndefined();
    }
);

it("keeps the protected backend on each listener instance", () => {
    class ContextListener extends BackendListener {
        constructor(backend) { super(["items", "item_id"], backend); }
        context() { return this.backend; }
    }
    const firstBackend = {}, secondBackend = {};
    const first = new ContextListener(firstBackend), second = new ContextListener(secondBackend);
    expect(first.context()).toBe(firstBackend);
    expect(second.context()).toBe(secondBackend);
    expect(Object.hasOwn(first, "backend")).toBe(true);
});
