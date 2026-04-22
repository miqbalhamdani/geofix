---
name: Technical Precision
colors:
  surface: '#fdf8f8'
  surface-dim: '#ddd9d8'
  surface-bright: '#fdf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3f2'
  surface-container: '#f1edec'
  surface-container-high: '#ebe7e6'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f4f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e1dfdf'
  on-secondary-container: '#626262'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1a'
  on-tertiary-container: '#868382'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#e4e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e6e2df'
  tertiary-fixed-dim: '#cac6c4'
  on-tertiary-fixed: '#1c1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#fdf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  mono-label:
    fontFamily: monospace
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 24px
  lg: 40px
  gutter: 24px
  margin: 32px
---

## Brand & Style

This design system is built on the principles of **Minimalism** and **Technical Precision**. It targets a professional audience that values clarity over decoration. The brand personality is clinical, reliable, and unobtrusive, positioning the product as a sophisticated tool rather than a lifestyle app.

The UI avoids unnecessary visual noise, utilizing heavy whitespace and a restricted palette to direct focus toward data and functionality. The emotional response should be one of "quiet confidence"—a system that feels stable, engineered, and highly performant.

## Colors

The palette is strictly achromatic to maintain a professional, high-utility aesthetic. 

- **Primary Canvas:** Pure white (#FFFFFF) is used for the main workspace and cards to maximize legibility.
- **Sectioning:** A light grey (#F5F5F5) is used for sidebars, secondary navigation, and background fills to create structural separation without high-contrast jarring.
- **Borders:** Soft grey (#E0E0E0) defines boundaries. Use these consistently for input fields, card outlines, and dividers.
- **Typography:** Dark grey (#1A1A1A) provides high contrast for body text, while a medium grey (#666666) is reserved for secondary metadata and labels.

## Typography

This design system utilizes **Inter** for its systematic and utilitarian qualities. The typographic scale is restrained to ensure a technical feel.

- **Headlines:** Use tighter letter-spacing and semi-bold weights for hierarchy.
- **Body:** Standard body text is set at 14px or 16px to maintain a compact, "pro" tool appearance.
- **Labels:** Use uppercase with slight tracking for section headers to distinguish them from interactive elements.
- **Technical Data:** For IDs, hashes, or coordinates, fall back to a system monospace font to reinforce the "technical" narrative.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for dashboard views, ensuring that data density remains predictable across different screen sizes. A 12-column grid is standard for main content areas.

- **Rhythm:** An 8px linear scale drives the spacing logic, but 12px increments are used for internal component padding to match the corner radii.
- **Density:** Favor "Comfortable" density for marketing pages and "Compact" density for SaaS data tables and toolbars.
- **Alignment:** All elements must align to the grid edges; avoid "floating" elements that do not have a clear structural relationship with the rest of the layout.

## Elevation & Depth

This design system relies on **Tonal Layers** and **Low-contrast outlines** rather than traditional shadows.

- **Surface Levels:** 
    - Level 0: #F5F5F5 (Background/Sidebar)
    - Level 1: #FFFFFF (Main Content/Cards)
- **Shadows:** Use only one "Micro-Shadow" for interactive elements (like buttons or active dropdowns). The shadow should be barely perceptible: `0px 2px 4px rgba(0,0,0,0.05)`.
- **Depth:** Depth is primarily communicated through 1px solid borders (#E0E0E0). When an element is hovered, the border should darken slightly to #CCCCCC rather than adding a larger shadow.

## Shapes

The shape language is defined by geometric precision. 

- **Corner Radii:** A consistent 8px radius is used for small components (buttons, inputs). For larger containers (cards, modals), use a 12px radius.
- **Consistency:** Do not mix sharp corners with rounded ones. If a container is rounded, all nested elements within it (such as progress bars or images) must also follow the roundedness scale.
- **Buttons:** Buttons should not be pill-shaped; they must maintain the standard 8px radius to feel "technical" rather than "playful."

## Components

- **Buttons:** Primary buttons use #1A1A1A background with white text. Secondary buttons use a white background with a #E0E0E0 border. State changes are indicated by subtle background shifts (e.g., #F5F5F5 on hover for secondary).
- **Input Fields:** 1px solid border (#E0E0E0), 8px radius, and 12px horizontal padding. Use a #1A1A1A 2px border for the `focus` state.
- **Cards:** White background, 1px border (#E0E0E0), and a 12px radius. No shadow unless the card is draggable or floating.
- **Chips/Tags:** Small 4px radius, #F5F5F5 background, and #666666 text for a neutral, metadata-heavy look.
- **Data Tables:** Row-based layouts with #E0E0E0 dividers. Use `body-sm` for table cell content to maximize information density.
- **Navigation:** Vertical sidebars should use the #F5F5F5 background to distinguish the "control" area from the "workspace" area.