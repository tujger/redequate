export default async function observeAuthState({auth, callback, onError, subscribe, signature = () => undefined}) {
    const reportError = error => {
        try {
            if (onError) onError(error);
            else console.error(`[${auth.constructor.name}] Auth state observer failed`, error);
        } catch (callbackError) {
            console.error(`[${auth.constructor.name}] Auth error callback failed`, callbackError);
        }
    };
    let active = true;
    let sequence = 0;
    let previous;
    const notify = user => {
        if (!active) return;
        const current = ++sequence;
        const deliver = loaded => {
            if (!active || current !== sequence) return;
            const key = signature(loaded);
            if (key !== undefined && key === previous) return;
            previous = key;
            return callback(loaded);
        };
        try {
            const loaded = auth._loadUserData(user);
            const pending = loaded && loaded.then instanceof Function ? loaded.then(deliver) : deliver(loaded);
            if (pending && pending.then instanceof Function) Promise.resolve(pending).catch(reportError);
        } catch (error) {
            reportError(error);
        }
    };
    const sourceError = error => {
        if (!active) return;
        ++sequence;
        reportError(error);
    };
    let unsubscribe;
    try {
        unsubscribe = await subscribe(notify, sourceError);
    } catch (error) {
        active = false;
        throw error;
    }
    return () => {
        active = false;
        unsubscribe();
    };
}
