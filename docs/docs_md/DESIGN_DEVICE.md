# Design System Specification: High-End Agricultural Intelligence

## 1. Overview & Creative North Star
**The Creative North Star: "The Digital Agronomist"**

This design system moves away from the "industrial dashboard" aesthetic. Instead, it adopts a **High-End Editorial** approach that treats agricultural data with the same reverence as a premium lifestyle journal. We are blending the precision of AI with the tactile, organic reality of the field.

To break the "template" look, we utilize **Intentional Asymmetry**. Dashboards should not be rigid grids; they should be composed of varying card heights and "floating" data layers. We use overlapping elements—such as a sensor readout partially overlaying a high-resolution field map—to create a sense of depth and sophisticated curation. The goal is a UI that feels "grown," not just "built."

---

## 2. Colors & Surface Philosophy
The palette is rooted in the earth, using deep forest tones and clay neutrals to provide a calm, professional backdrop for high-tech monitoring.

### The "No-Line" Rule
**Prohibition:** 1px solid borders are strictly forbidden for sectioning or defining containers. 
**Execution:** Boundaries must be defined solely through background color shifts. Use `surface-container-low` for secondary sections sitting on a `surface` background. The eye should perceive change through tonal transition, not a "drawn" line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers, like stacked sheets of fine, heavy-weight paper.
*   **Base:** `surface` (#fff8f5) - The primary canvas.
*   **Level 1:** `surface-container-low` (#fbf2ed) - For large secondary groupings.
*   **Level 2:** `surface-container` (#f5ece7) - For primary interaction cards.
*   **Level 3:** `surface-container-highest` (#eae1dc) - For modal overlays or high-priority floating alerts.

### The "Glass & Gradient" Rule
To elevate the "Smart Farming" feel, use **Glassmorphism** for floating headers or navigation rails. 
*   **Token:** `surface-container-lowest` at 80% opacity with a `24px` backdrop-blur. 
*   **Signature Textures:** Apply a subtle linear gradient to Primary CTAs (from `primary` #002d1c to `primary-container` #00452e). This adds a "silk-finish" depth that feels premium and intentional.

---

## 3. Typography
We employ a dual-sans-serif system to balance editorial character with data-heavy utility.

*   **Display & Headline (Manrope):** Used for large data summaries and section headers. Manrope’s geometric yet warm curves provide the "Technology" side of the brand.
*   **Title, Body, & Label (Inter):** Used for all functional data, sensor readouts, and descriptions. Inter’s high x-height ensures maximum legibility for farmers viewing screens in high-glare outdoor environments.

**Hierarchy as Identity:**
Use `display-lg` for single, heroic KPIs (e.g., Soil Moisture %). By scaling the typography to an "Editorial" size, we signal the importance of the data point, removing the need for loud colors or heavy icons.

---

## 4. Elevation & Depth
Depth is a functional tool, not a decorative one. We achieve hierarchy through **Tonal Layering**.

### The Layering Principle
Rather than using shadows to lift every card, stack your surfaces. A `surface-container-lowest` card placed on a `surface-container-low` section creates a natural "lift" that mimics the way light hits layered materials.

### Ambient Shadows
When a card must float (e.g., a "New Alert" popover), use an **Ambient Shadow**:
*   **Blur:** 32px to 64px.
*   **Opacity:** 4% - 6%.
*   **Tint:** Use a tinted version of `on-surface` (#1f1b18) rather than pure black. This mimics natural light filtered through a canopy.

### The "Ghost Border" Fallback
If accessibility requirements demand a container edge, use a **Ghost Border**: `outline-variant` (#c1c8c2) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary-container`), white text, `xl` (1.5rem) rounded corners.
*   **Secondary:** `surface-container-highest` fill with `on-surface` text. No border.
*   **Tertiary:** Ghost style. `on-surface` text with an icon. No container until hover.

### Input Fields
*   **Style:** Filled containers using `surface-container-low`. 
*   **Indicator:** A 2px bottom-bar using `primary-fixed-dim` appears only on focus.
*   **Corners:** `md` (0.75rem) to maintain a friendly, approachable feel.

### Cards & Lists
*   **The No-Divider Rule:** Explicitly forbid horizontal line dividers. 
*   **Separation:** Use the Spacing Scale (typically `spacing-6` or `spacing-8`) to create "white space moats" between list items. For complex lists, use alternating background tints of `surface` and `surface-container-low`.

### Specialized Components: "The Vitality Chip"
For sensor status, use high-contrast chips.
*   **Healthy:** `secondary-container` (#d3e89d) fill with `on-secondary-container` (#57692c) text.
*   **Critical:** `error-container` (#ffdad6) fill with `on-error-container` (#93000a) text.

---

## 6. Do’s and Don'ts

### Do:
*   **Use Intentional White Space:** Treat the screen like a gallery wall. Give the data room to breathe.
*   **Use "Soft" Accents:** Use the `tertiary` (Earthy Brown) palette for secondary data like "Last Synced" or "System Logs" to keep the focus on the "Green" growth data.
*   **Respect the Scale:** Use the `rounded-xl` (1.5rem) corner radius for main containers to echo organic, soft shapes found in nature.

### Don’t:
*   **Don't use 100% Black:** It is too harsh for the "Nature" aesthetic. Always use `on-surface` (#1f1b18).
*   **Don't use Grids for Everything:** Allow some elements to be center-aligned or offset to create a custom, high-end feel.
*   **Don't use Heavy Shadows:** If the shadow is the first thing you notice, it's too dark. It should be a whisper of depth.

### Accessibility Note
While we prioritize a minimalist aesthetic, ensure that all text-on-background combinations meet WCAG AA standards. Use the `on-primary` and `on-secondary` tokens specifically designed for high-contrast legibility against their respective containers.