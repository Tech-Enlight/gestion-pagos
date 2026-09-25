---
name: Enlight
description: Solar/BESS energy company — analytical, empathetic, technically credible
colors:
  acero: "#293C47"
  jade: "#00AA85"
  cerceta: "#3D7D80"
  marino: "#121926"
  gris: "#828080"
  bone: "#F5F6F7"
  mist: "#E6EAEC"
  fog: "#C5CCD0"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Alexandria, Inter, system-ui, sans-serif"
    fontSize: "clamp(48px, 6vw, 88px)"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Alexandria, Inter, system-ui, sans-serif"
    fontSize: "clamp(32px, 3.5vw, 44px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Alexandria, Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 300
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Albert Sans, Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.14em"
rounded:
  xs: "2px"
  sm: "4px"
  md: "8px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.jade}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.acero}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.acero}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
---

# Design System: Enlight

## Overview

**Creative North Star: "The Field Engineer's Instrument"**

Enlight designs like a precision instrument for people who build and manage solar/BESS infrastructure: analytical, calm, technically credible, never decorative for its own sake. The palette is deliberately restrained — Acero (steel) and white carry the composition, Jade appears only as a signal (a call to action, a confirmed state, the one accent that means "go"). Nothing bounces, nothing shouts; the brand's warmth comes from generous whitespace and soft-organic curvature (the "curva" motif), not from color noise.

**Key Characteristics:**
- Restrained accent use — Jade marks the single most important action or state on a screen, never a background fill
- Soft-organic radii, never sharp corners, never a giant unbroken pill except on true pill-shaped controls
- Measured motion (cubic-bezier(.4,0,.2,1)), 120–320ms, never bouncy or elastic
- Alexandria for anything a reader stops on (headlines, body); Albert Sans only for UI chrome (labels, captions, technical microcopy)

## Colors

Steel and white dominate; Jade is scarce and load-bearing.

### Primary
- **Acero** (#293C47): Primary dark. Body text on light surfaces, dark backgrounds, primary borders. Carries ~50% of any composition together with white.
- **Jade** (#00AA85): THE brand signal. Primary CTAs, confirmed/success states, active nav indicators, the one accent per screen. Never used as a large fill — it loses meaning if it's everywhere.

### Secondary
- **Cerceta** (#3D7D80): Secondary accent. Overlays, large decorative fills, secondary data series. ~25% of composition.
- **Marino** (#121926): Near-black. Digital dark-mode backgrounds, deep overlays.
- **Gris** (#828080): Neutral. Captions, labels, dividers, disabled states.

### Neutral
- **Bone** (#F5F6F7): Off-white card/page background.
- **Mist** (#E6EAEC): Hairlines, dividers on light backgrounds.
- **Fog** (#C5CCD0): Disabled text, placeholders.
- **White** (#FFFFFF): Base page background, text on dark.

### Named Rules
**The One Signal Rule.** Jade appears once per screen as the thing that matters most (primary CTA, active state, success). If two elements compete for Jade, one of them is wrong.

**The 50/25/25 Rule.** 50% primary (Acero/white), 25% secondary fills (Cerceta/Marino/Gris), 25% separators and motifs. Never let secondary tones creep past a quarter of the composition.

## Typography

**Display Font:** Alexandria (with Inter, system-ui fallback)
**Body Font:** Alexandria (with Inter, system-ui fallback)
**Label/Mono Font:** Albert Sans (with Inter, system-ui fallback)

**Character:** Alexandria is geometric and roomy — it carries the brand's analytical, precise register at every reading size. Albert Sans is reserved strictly for UI chrome (labels, captions, eyebrows) so it never competes with Alexandria for a reader's attention.

### Hierarchy
- **Display** (weight 300, clamp(48px,6vw,88px), line-height 1.05): Hero headlines only, Alexandria Light.
- **Headline** (weight 600, clamp(32px,3.5vw,44px), line-height 1.2): Section titles, Alexandria SemiBold.
- **Title** (weight 700, 18px, line-height 1.4): Card/subtitle headers, Alexandria Bold.
- **Body** (weight 300, 15px, line-height 1.55): Paragraph copy, Alexandria Light. Max ~70ch line length.
- **Label** (weight 500, 12px, letter-spacing 0.14em, uppercase): Eyebrows, tags, form labels, Albert Sans Medium.

### Named Rules
**The Two-Family Rule.** Alexandria for anything read; Albert Sans for anything scanned (chrome, labels). Never introduce a third typeface.

## Layout

12×12 grid (extendable to 24×24), 8px-multiple spacing scale (4/8/16/24/32px steps) nested inside it. Generous whitespace is part of the brand's "instrument" feel — density is a last resort, not a default.

## Elevation & Depth

Flat-by-default, tonal layering preferred over shadows. When shadows are used, they are soft and cool-tinted (never warm) — tinted by Marino, not neutral black, so they read as part of the brand's palette rather than a generic UI shadow.

### Shadow Vocabulary
- **shadow-1** (`0 1px 2px rgba(18,25,38,.06), 0 1px 1px rgba(18,25,38,.04)`): Resting cards, subtle separation.
- **shadow-2** (`0 4px 12px rgba(18,25,38,.08), 0 2px 4px rgba(18,25,38,.04)`): Hover state, raised elements.
- **shadow-3** (`0 12px 32px rgba(18,25,38,.12), 0 4px 12px rgba(18,25,38,.06)`): Modals, popovers.

### Named Rules
**The Cool Shadow Rule.** Shadows are always tinted with Marino rgba, never plain black — warm/neutral shadows read off-brand immediately.

## Shapes

Soft-organic radii throughout: 2px (xs, hairline elements) to 16px (lg, cards/panels), with a 999px pill reserved for true pill controls (tags, toggle switches) — not stretched onto rectangular buttons or inputs. The brand's signature large half-oval "curva" arc is reserved for hero/section dividers, never applied to interactive controls.

## Components

### Buttons
- **Shape:** 8px radius (rounded.md)
- **Primary:** Jade background, white text, 12px/24px padding
- **Hover / Focus:** Primary shifts to Acero background on hover; focus ring is `0 0 0 3px rgba(0,170,133,.35)` (Jade at 35%)
- **Ghost:** Transparent background, Acero text and border, used for secondary actions

### Cards / Containers
- **Corner Style:** 8–16px radius
- **Background:** White or Bone
- **Shadow Strategy:** shadow-1 at rest, shadow-2 on hover
- **Border:** 1px Mist hairline when not using shadow for separation

### Inputs / Fields
- **Style:** 1px Mist border, 8px radius, white background
- **Focus:** Border shifts to Jade, focus ring `0 0 0 3px rgba(0,170,133,.35)`
- **Disabled:** Fog text/border

### Navigation
- **Style:** Acero text on white/light, active item marked with Jade underline or icon fill — not a full Jade background pill.

## Do's and Don'ts

### Do:
- **Do** use Jade as the single accent signaling the primary action or success state per screen.
- **Do** use Alexandria Light for body copy and display; reserve SemiBold/Bold for headings only.
- **Do** use Albert Sans exclusively for UI chrome — labels, eyebrows, captions.
- **Do** tint shadows with Marino, never neutral black.
- **Do** use brand icons from `assets/icons/` for product/sector concepts, and Lucide (thin-rounded stroke) for generic UI chrome — they're drawn to match stroke weight.

### Don't:
- **Don't** use Jade as a large background fill or on more than one element per screen.
- **Don't** introduce any typeface beyond Alexandria and Albert Sans.
- **Don't** use sharp corners (0 radius) anywhere in the UI — the brand is soft-organic throughout.
- **Don't** use bouncy/elastic easing — motion is measured (cubic-bezier(.4,0,.2,1)), 120–320ms.
- **Don't** stretch the 999px pill radius onto rectangular buttons or cards — reserve it for tags/toggles/true pill controls.
