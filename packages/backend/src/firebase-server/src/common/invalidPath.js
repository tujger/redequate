// Firebase forbids ASCII control characters in keys and paths.
// eslint-disable-next-line no-control-regex
export default /[.#$[\]\x00-\x1f\x7f]/;
