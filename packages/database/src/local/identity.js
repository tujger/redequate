// Stored path keys are JSON arrays of literal, fixed and dynamic identity tokens.
export const identityTokens = pathKey => JSON.parse(pathKey);

export const identityField = token => token?.[0] === "dynamic"
    ? token[2]
    : token?.[0] === "fixed" ? token[1] : undefined;
