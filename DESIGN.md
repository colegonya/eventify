---
name: Greek Social Calendar
description: A ruled, printed-planner system for a chapter's semester of events, budget, and contacts
colors:
  paper: "#F6F5F2"
  paper-line: "#DEDBD3"
  surface-1: "rgba(28, 28, 26, 0.035)"
  surface-2: "rgba(28, 28, 26, 0.06)"
  brand-primary: "#1E3A5F"
  brand-accent: "#B8892B"
  brand-accent-deep: "#7A5A17"
  brand-ink: "#1C1C1A"
  foreground: "#1C1C1A"
typography:
  masthead:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  body:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
  figures:
    fontFamily: "Geist Sans, ui-sans-serif, system-ui, sans-serif"
    fontFeature: "tnum"
    fontWeight: 500
rounded:
  none: "0px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  chip-event:
    backgroundColor: "category color"
    textColor: "computed contrast"
    rounded: "{rounded.xs}"
    padding: "2px 6px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "16-20px"
---

# Design System: Greek Social Calendar

## Overview

**Creative North Star: "The Season Wall Planner"**

The system reads as a large paper term-planner pinned to a chapter-room wall, not a SaaS admin dashboard. It runs on two registers, not one: literal ledger/grid geometry (the calendar's day cells, the ruled rows inside Budget's and Contacts' tables) stays flat and hairline-ruled, exactly like ink on paper — but everything that isn't literal ruled paper (stat tiles, form panels, the modal, dropdowns) is a real surface with a soft radius and a resting shadow, the way a stack of index cards or a clipboard sits with actual depth on a desk. The first version of this system applied "flat, 0-radius, no-shadow" everywhere without that distinction, which read as sterile and checkerboarded rather than clean; this version is the correction, not a different world.

This is a deliberately neutral, workhorse system, not a Greek-life theme. Nothing here references crests, letters, or party iconography; the planner/ledger metaphor is drawn from general small-org admin culture (the wall calendar, the treasurer's cashbook) because the audience explicitly wants a professional tool, not a themed one. Personality lives in restrained, specific craft — the ruling, the masthead's primary-colored underline, the sticker-style event tag, tabular figure alignment, a resting shadow under a panel — never in decoration layered on top.

Every chapter overrides `--color-brand-primary` / `--color-brand-accent` / `--color-brand-accent-deep` / `--color-brand-ink` at runtime from Settings. This system's job is to look intentional and legible across a wide, unpredictable range of chapter color pairs, not just the shipped default. Color is therefore structural (rules, active states, today marker, the masthead underline, category ticks) rather than decorative (no gradients, no tinted card backgrounds standing in for hierarchy).

**Key Characteristics:**
- Two registers: flat, hairline-ruled ledger/grid geometry vs. real depth (radius + resting shadow) on every panel that isn't literal ruled paper. Never mix the two on the same element.
- One workhorse sans family (Geist, already in the project) across every role; hierarchy comes from weight, size, and tracking, never a second display face.
- Tabular, right-aligned figures anywhere money or counts appear.
- A masthead band (bold, large-scale label, underlined in brand-primary) opens every top-level page, standing in for a printed planner's month/section header.
- Motion is small and universal: every interactive element gets a matching hover/focus/active state and a real transition — nothing snaps while its neighbor eases.

## Colors

A near-neutral paper ground carries the system; two brand-role colors (primary, accent) do the structural work, two neutral surface steps carry background layering, and category colors — set per chapter, arbitrary — are the only saturated fills.

### Primary
- **Fountain Ink** (`--color-brand-primary` #1E3A5F): active nav underline, primary buttons, today's date marker, focus rings, the masthead's underline. The default demo value; every deployment overrides it.
- **Primary Ink** (`--color-brand-primary-ink`, computed): the text/icon color for anything filled with brand-primary, chosen server-side (`src/app/layout.jsx`) by running the resolved primary — custom or default — through `contrastTextColor` (`src/lib/color.js`). Never hardcode `text-white` on a brand-primary fill: a chapter can set primary to a light color, and white-on-white is a real failure mode this token exists to prevent.

### Secondary
- **Highlighter Gold** (`--color-brand-accent` #B8892B): the one warm accent — used the way a highlighter tab is used on a real planner, for the single thing on a view that most needs a second signal (a tentative-event indicator, a pending-approval badge, an over-budget flag). A highlighter reads opaque and vivid on paper, not a pale wash: accent badges sit at 25-45% fill with semibold text, not the 15% tint the first version shipped with. Still never a large-region fill.
- **Highlighter Gold, Deep** (`--color-brand-accent-deep` #7A5A17): text set on an accent-tinted ground, where the base accent fails AA.

### Neutral
- **Paper** (`--background` #F6F5F2): page ground, and the fill for every real panel (Cards/Containers below) — panels don't get a separate "card white," they're the same paper lifted on a shadow.
- **Paper Line** (`--color-paper-line` #DEDBD3): every hairline rule — grid cell lines, table row rules, input borders at rest. One rule per boundary: don't stack a container border, a header-row border, and a row border for the same edge (see Layout).
- **Surface 1** (`--color-surface-1`, ~3.5% ink): chrome separation — the app header, table header rows. Replaces the ad hoc `bg-brand-ink/[0.02]` through `/[0.04]` fractions the first version scattered per component.
- **Surface 2** (`--color-surface-2`, ~6% ink): hover/active tint for rows and flat elements that don't get a shadow (table rows, mobile list rows). Replaces the old `/[0.06]` ad hoc fraction.
- **Graphite** (`--foreground` and `--color-brand-ink`, both #1C1C1A by default): the default text/border neutral, used throughout components via `text-brand-ink`, `border-brand-ink/*`. It's a brand-overridable slot (chapters can retint it from Settings) but defaults to true near-black graphite, not a colored slate, so running text stays legible regardless of a chapter's primary/accent choice. Two deliberate opacity steps carry secondary text: `/70` for "secondary but live" (a day number, a helper line), `/40` for "genuinely inactive" (a dimmed month's dates) — not the five-ish ad hoc fractions (`/30` `/40` `/50` `/60` `/75`) scattered through the first version.

### Named Rules
**The Structural Color Rule.** Primary and accent are never a background fill for a content region. They mark state (active, today, selected, flagged, the masthead underline) and controls (buttons, links, focus). Category colors are the system's only large-area color, because they're the one color role a chapter's own data defines, not the chassis.

**The Fixed-Severity Rule.** Conflict severity (`CONFLICT_STYLES`), the contact-status pill colors, and the "needs attention" budget alert are fixed semantic colors (red/amber/green), independent of a chapter's brand primary/accent. A chapter's palette might not contain anything that reads as "warning," so these stay universal rather than brand-derived — this is deliberate, not undocumented drift.

## Typography

**Body/Display/Label Font:** Geist Sans (the project's existing font, no new family introduced), with `ui-sans-serif, system-ui, sans-serif` fallback.

**Character:** One workhorse grotesque doing every job. Hierarchy is entirely weight, size, and tracking — never a second family — because this is an Operate surface a rotating volunteer reads under time pressure, not a surface asking to be admired.

### Hierarchy
- **Masthead** (700-800, 1.5rem/24px desktop page headers, 1.05-1.1, tight tracking, brand-primary underline): section identity — the page's own name, a month/range label, a semester name. The one place weight and color both go maximal.
- **Title** (600, 0.9375rem/15px): fieldset legends ("Schedule", "Budget"), Settings section headers, card/table/group headers ("Per-event detail", an org's own name in Contacts), modal titles ("Edit Event"), the drink calculator toggle. This tier exists precisely so real content and group headers don't visually merge with small uppercase chrome — use it instead of Label whenever the text names a group of real content rather than a column or a status.
- **Body** (400, 0.875rem/14px, 1.4): everything read at length — forms, table cells, descriptions.
- **Label** (600, 0.6875-0.75rem/11-12px, 0.02-0.05em tracking, uppercase where it names a column or state): column headers, status words, weekday labels, nav tabs (13px). Event chip / day-cell text runs as small as 11px under real density — that floor is intentional, not drift.
- **Figures** (500, tabular-nums feature): every number that represents money, a count, or a date-in-a-grid. Right-aligned wherever it sits in a column of other figures.
- **Chart label** (600, 22px): the pie chart's in-slice percentage labels — the one place type reads at poster scale, because it's substituting for a data label at arm's length, not running text.

### Named Rules
**The Tabular Figures Rule.** Any numeral standing for money or a count sets `font-variant-numeric: tabular-nums` and right-aligns within its column — including small inline badges (a cap-% pill), not only table cells. This is the one deliberate ledger borrowing in an otherwise planner-led system, and it's non-negotiable in Budget.

## Layout

Density and information-per-glance outrank whitespace-as-luxury; this is checked between classes, not lingered over. Spacing steps: 4 / 8 / 12 / 20px; tight within a row, one full step more before a new section than after the one before it.

**One rule per boundary, not one per nesting level.** The most common defect in the first version was stacking a hairline at every level of nesting at once — a page's own toolbar border directly under the header's border, an outer table border plus a header-row border plus every row's own border, a card border wrapping another card's border. Before adding a rule, check whether an existing rule, a background tint, or plain whitespace already marks that boundary. A hairline earns its place at genuine ledger/grid geometry (the calendar's cells, a table's row-to-row rules) — it does not get repeated around every container that happens to hold ruled content.

**No card-on-card nesting**, ever — not even at reduced opacity. If content genuinely groups into two levels (an org, and the contacts under it), the outer level gets the panel treatment (see Cards / Containers) and the inner level is separated by a single internal `divide-y` rule or plain spacing, never its own border-and-fill.

Sections open with a masthead band (see Typography) rather than a small gray eyebrow, and the masthead's own underline is the only chrome at the top of a page — don't also draw a full-width rule under the toolbar row below it (the global header already owns the one rule above the masthead).

Responsive: mobile keeps the same structural discipline at reduced density (fewer visible columns, same rule weight, same panel treatment) rather than switching to an unrelated stacked-card pattern.

## Elevation & Depth

Two registers, not one flat rule. **Ledger/grid geometry** (calendar day cells, table row-to-row rules) stays genuinely flat: no shadow, hairline rules only, exactly as ink sits on paper. **Everything else that groups content into a panel** — stat tiles, form sections, the equipment/per-event table's own outer edge, dropdowns, the modal — is a real surface: `--radius-md` (or `--radius-lg` for overlays) plus a resting shadow, the way a card or clipboard actually has thickness on a desk. The first version banned shadows everywhere including this second register, which is what made panels read as flat outlines rather than surfaces; this version restores depth specifically where the paper metaphor calls for a lifted object; ruled-paper geometry itself stays flat.

An interactive panel (a clickable row, a hoverable card) steps from `resting` to `hover` shadow on hover; a static panel (a stat tile, a form section) only ever shows `resting` — don't add hover elevation to something nothing happens when you click.

### Shadow Vocabulary
- **resting** (`box-shadow: 0 1px 2px rgba(28,28,26,0.05)`): the default state for every real panel — stat tiles, form sections, table/list containers, dropdown-free cards. Pairs with a 1px Paper Line border and `--radius-md`.
- **hover** (`box-shadow: 0 2px 6px rgba(28,28,26,0.1)`): the hover step for panels that are themselves clickable. Table/list *rows* use a `surface-2` background tint instead of a shadow step — shadow marks a panel lifting, not a row highlighting.
- **lifted** (`box-shadow: 0 6px 16px rgba(28,28,26,0.18)`): a genuine drag state (an event chip mid-drag; implemented with a small `scale-[1.03]` alongside it) or an open dropdown/menu.
- **overlay** (`box-shadow: 0 12px 32px rgba(28,28,26,0.22)`): the modal/dialog panel, paired with `--radius-lg` — shape and light have to agree, so an elevated panel with a soft shadow always gets a real corner radius, never a hard 90° corner.

### Named Rules
**The Two-Register Rule.** Literal ruled-paper geometry (grid cells, table rows) is flat with hairline rules; everything else that reads as a lifted panel gets radius + resting shadow. Putting a shadow on ledger geometry, or leaving a stat tile/form panel completely flat, are both bugs.

## Shapes

Four steps above 0, used by register, not interchangeably:
- **0px** — literal ledger/grid geometry only: the calendar grid's cell intersections, table `<tr>`/`<td>` rules.
- **`--radius-xs` (4px)** — small tags: event chips, the game-day dashed tag, a legend swatch, an uppercase group-label tag.
- **`--radius-sm` (6px)** — the workhorse control radius: buttons, text inputs, color swatches, the month/week toggle.
- **`--radius-md` (8px)** — grouped, non-ledger panels: stat tiles, form sections, Contacts' org cards, the outer edge of a table/list container.
- **`--radius-lg` (12px)** — overlay-only: the event/equipment editor modal, the Legend flyout, open dropdown menus. A deliberate, scoped exception to "nothing above `radius-md`" — limited to these overlay types, not general use.

Event markers are solid-fill tag rectangles at `--radius-xs` (a printed sticker label), not soft shadowed pills. The today marker is a solid filled circle (a hole-punch/pin dot), not an outlined ring.

## Components

### Buttons
- **Shape:** `--radius-sm` (6px).
- **Primary:** brand-primary background, Primary Ink text (`--color-brand-primary-ink`, never a hardcoded `text-white`), 8px/14px padding, no shadow at rest (a button is a control, not a panel).
- **Hover/Focus/Active:** `hover:brightness-110`, `active:brightness-95` — both must ride `transition-all` (or an explicit `transition-[filter,...]`), never bare `transition-colors`, which does not cover the `filter` property `brightness()` uses and silently makes the hover snap instead of ease. This exact bug shipped on every primary button in the first version. Focus-visible gets a 2px brand-primary ring, never a glow.
- **Secondary/Ghost:** Paper background, Paper Line border (1px), Graphite text; hover fills to Paper Line/Surface 2 tint, with `transition-colors`.

### Chips (event markers)
- **Style:** solid category-color fill, `--radius-xs` corners, computed-contrast text (existing `contrastTextColor` logic retained), no shadow at rest — the flat fill itself is what reads as a placed sticker label.
- **State:** conflict severity restyles the whole chip (existing `CONFLICT_STYLES`), never adds a decorative ring; tentative events get a dashed 2px outline, matching the incumbent convention. Hover dims slightly (`brightness-95`, darken not lighten, so light category colors don't wash out) and focus-visible gets a brand-primary ring — this is the single most-clicked element in the app and must show it's interactive. Mid-drag, the chip's wrapper lifts to `--shadow-lifted` with a small `scale-[1.03]`.

### Status Pill (Contacts)
The one deliberate exception to the Inputs spec below: the contact-status `<select>` (`ContactsTable.jsx`) renders as a solid-fill, `rounded-full`, borderless pill colored by its own value (not brand-derived — see The Fixed-Severity Rule), the same register as a rubber stamp on an index card. It's a status control, not a text field, so it doesn't inherit the ruled-input treatment. All three status colors sit at full opaque boldness — including the accent-colored one, which must not read weaker than its fixed-color siblings.

### Cards / Containers
Two distinct kinds — don't blend them:
- **Ledger containers** (a table's outer edge, a day cell): 0px corners, no border of their own beyond the row/cell rules already inside them, no shadow. The internal rules are the container.
- **Panels** (stat tiles, form sections, org cards, dropdowns): `--radius-md` (or `--radius-lg` for overlays), 1px Paper Line border, `--shadow-resting`, Paper background. No card-on-card nesting — an inner grouping inside a panel is a `divide-y` rule or spacing, never its own bordered box.
- **Internal padding:** 8-12px in dense table/grid contexts, 16-20px in form/modal panels.

### Inputs / Fields
- **Style:** Paper background, 1px Paper Line border, `--radius-sm` (6px).
- **Focus:** border steps to Fountain Ink, 2px Fountain Ink ring at 15% opacity, `transition-colors` — no glow, no scale change.
- **Error:** border and helper text in a standard error red; never relies on color alone (icon + text).

### Navigation
- Flat tab row, Label-weight text, 2px bottom rule on the active tab in Fountain Ink; inactive tabs get no rule, only Graphite-at-70%-opacity text stepping to full Graphite on hover (with `transition-colors`). No pill/rounded-background active state, no backdrop-blur on the header — the header separates from content with a single Paper Line rule, on a Surface 1 tint distinct from the page body.

### Masthead Band (signature component)
The section-opening treatment: a Masthead-weight label (the page name, the visible month/range, or a semester name) set large against the Paper ground, with a `border-b-[3px] border-brand-primary` underline sized to the text itself (`<Masthead>` component, `inline-block`) — the one deliberate color signature on every page. Every top-level page opens with one, and it is the *only* rule at the top of the page content; it replaces both the incumbent's small `text-lg font-semibold` headers and the redundant full-width neutral rule the first version drew under the whole toolbar row.

### Modal / Dialog
`--radius-lg` (12px) panel, `--shadow-overlay`, 1px Paper Line border. Entrance only (not exit) plays a 150ms fade + 4px translate on the scrim and panel (`animate-scrim-in` / `animate-panel-in` in `globals.css`) since both are conditionally mounted, not toggled — closing stays an instant unmount so a volunteer closing out of a form never waits on an animation.

## Do's and Don'ts

### Do:
- **Do** rule off literal ledger/grid geometry (calendar cells, table rows) with a single 1px Paper Line hairline per boundary — never stack a container rule on top of rules that already imply containment.
- **Do** give every non-ledger panel real depth: `--radius-md`+ and `--shadow-resting`, not a flat bordered rectangle.
- **Do** right-align and tabular-align every figure that represents money or a count, including small inline badges.
- **Do** keep every deployment's brand primary/accent as the only saturated chassis color; let category colors (chapter-owned data) be the rest of the palette. Give accent real boldness (25-45% fill, semibold) where it's meant to be a highlighter, not a wash.
- **Do** open every top-level page with a Masthead band, underlined in brand-primary, and nothing else at the top of the page.
- **Do** pair every hover/focus/active state with a real, matching transition — `transition-all` or an explicit property list that includes whatever the state actually changes (color *and* filter *and* shadow, as needed).

### Don't:
- **Don't** introduce a second type family for "personality" — this is a workhorse Operate surface, not a Persuade one.
- **Don't** use `rounded-lg`/`rounded-xl`-scale Tailwind defaults or soft `shadow-sm` card containers from outside this system's own token scale; `--radius-lg` (12px) is reserved for overlays specifically, not general use.
- **Don't** use a colored `border-left`/`border-right` accent above 1px as a stand-in for a real state treatment.
- **Don't** nest a bordered-and-tinted box inside another bordered-and-tinted box, at any opacity.
- **Don't** pair `hover:brightness-*` with bare `transition-colors` — it does not transition `filter` and the hover will silently snap.
- **Don't** reach for Greek-life iconography (crests, letters, party motifs) as decoration; the system is intentionally neutral per product direction.
