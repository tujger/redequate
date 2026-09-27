# Project instructions

- Do not add wrapping parentheses `()` around JSX components in `return` statements or JSX markup unless necessary.
- Do not replace or remove Material UI icons during component conversions; keep their imports and usage unchanged.
- Use the minimum nesting needed to express selector relationships.
- Keep independent component classes at the top level.
- Use nesting for pseudo-classes, modifiers, global descendants, and selectors that require a parent relationship.
- Keep all at-rules, including `@media`, at the top level.
- Do not introduce wrapper nesting solely for visual grouping.
- Use CSS Module classes directly in the component. Remove `classes` from component props when external styling overrides are not needed.
- Prefer CSS custom properties for dynamic visual values when a modifier class would only carry a variable value.
- Use `useRippleEffect` for interactive controls that behave like buttons or navigation actions when visible Material UI-like press feedback is appropriate.
- Do not add ripple effects to passive containers, layout wrappers, loading placeholders, or components whose child already owns the interaction.
- When planning a component conversion, explicitly identify interactive elements that need ripple feedback and state whether ripple is required, unnecessary, or blocked by a child component API.
