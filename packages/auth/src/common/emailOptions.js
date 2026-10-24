/** Apply defaults only to omitted options; preserve provider-specific settings. */
export default function emailOptions(options, signInEmail) {
    const defaults = signInEmail === undefined ? undefined : {
        url: window.location.origin + "/signup/" + signInEmail,
        handleCodeInApp: true
    };
    if (options === undefined && defaults === undefined) return undefined;
    const settings = {...defaults};
    for (const [key, value] of Object.entries(options ?? {})) {
        if (value !== undefined) settings[key] = value;
    }
    return settings;
}
