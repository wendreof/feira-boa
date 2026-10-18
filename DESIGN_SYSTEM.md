# Feira Boa Design System

## Foundations

- Body text and controls use DM Sans; display headings use Manrope.
- Shared color tokens are defined in `styles.css`; dark-theme overrides live in `theme.css`.
- Use green for primary actions, white surfaces with a line border for secondary actions, and red only for destructive actions.
- Standard controls use an 8px radius. Segmented controls use 6px; icon-only favorites remain circular.

## Buttons

- Buttons share the same font family, focus ring, disabled behavior, tap treatment, and transition timing.
- Primary, secondary, selected, and destructive states communicate priority through color, not unrelated shapes or typography.
- Text actions remain visually quiet; icon-only actions keep a stable hit area and a descriptive accessible label.
- Prefer existing button classes (`account-button`, `filter`, `offer-reaction-button`, `favorite-toggle`, and `text-button`) and shared tokens over one-off styling.

## Responsive behavior

- Keep tap targets at least 30px for compact inline actions and 36px for standard controls.
- On mobile offer rows, keep the favorite adjacent to reaction controls and outside the product artwork tile.
- Preserve desktop placement when a layout change is explicitly mobile-specific.