import noopMuiTheme from "../../controllers/NoopMuiTheme";

describe("NoopMuiTheme", () => {
    it("allows existing style callbacks to run without returning theme data", () => {
        const styles = theme => ({
            avatar: {height: theme.spacing(5)},
            menu: {
                [theme.breakpoints.down("sm")]: {
                    left: theme.spacing(4),
                    top: theme.mixins.toolbar.minHeight,
                },
            },
        });

        expect(styles(noopMuiTheme)).toEqual({
            avatar: {height: undefined},
            menu: {"@media not all": {left: undefined, top: undefined}},
        });
        expect(noopMuiTheme.palette.primary.main.deeply.nested()).toBeDefined();
        expect(String(noopMuiTheme.palette.primary.main)).toBe("");
        expect(noopMuiTheme.typography.body1.fallbacks).toBeUndefined();
        expect(noopMuiTheme.breakpoints.keys).toEqual([]);
        expect(noopMuiTheme.overrides).toBeUndefined();
        expect(noopMuiTheme.props).toBeUndefined();
        expect(Object.keys(noopMuiTheme)).toEqual([]);
    });
});
