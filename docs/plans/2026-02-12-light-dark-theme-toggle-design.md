# Light/Dark Theme Toggle

## Overview

Add a light/dark theme toggle to the ER Timer app.  
Dark "Industrial Luxury" is default. Light mode restores the gold/cream neobrutalist styling using CSS custom-property overrides.

## Last Verified

- **February 15, 2026**

## Architecture

- `data-theme="dark"` (default) or `data-theme="light"` on `<html>`
- `:root` holds dark tokens; `[data-theme="light"]` overrides them with gold values
- React manages state in `src/App.jsx`, persists via `localStorage` key `er-timer-theme`
- Inline script in `index.html` applies persisted light theme before React mounts (flash prevention)

## Files

1. `src/index.css` — `[data-theme="light"]` block with all gold/cream tokens
2. `index.html` — inline script for flash prevention and meta `theme-color` adjustment
3. `src/App.jsx` — theme state + toggleTheme, passed to HomeScreen
4. `src/components/HomeScreen.jsx` — toggle button in settings area
5. `src/components/HomeScreen.css` — theme toggle button styles

## Implemented vs Planned

- **Implemented**
- Theme is stored in `localStorage` and applied to `<html data-theme="...">`
- Mobile browser theme color updates dynamically (`#0A0A0F` dark, `#FFBF00` light)
- Home screen settings panel includes the sun/moon toggle button
- Extensive light-theme component overrides exist in `src/index.css`

- **Changed from original plan**
- Light base now uses `#FFBF00` (`--surface-base`), not `#D4A827`
- Inline preload script is compact but not literally "3 lines"

- **Not in scope of this change**
- No OS-level `prefers-color-scheme` auto-detection
- No third theme variant

## Corrected Token Snapshot (Light Theme)

- Body/base: `#FFBF00` with gold gradient
- Cards: `#F5E6D3` cream, `#F2E0C8` warm cream
- Text: `#000000` primary, `#555555` secondary
- Borders: solid black (2-4px)
- Shadows: hard offset, no blur
- Accents: `#E91E63` pink, `#4DD0E1` cyan, `#4CAF50` green
- Display font token: Montserrat in light mode (`--font-display`)

## Toggle UI

- Sun/moon icon button in the settings collapsible on HomeScreen
- 36x40px, matches existing settings UI scale
