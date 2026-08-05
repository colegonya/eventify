# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Exec board officers of a fraternity or sorority chapter (social chair, treasurer, president, and similar roles) who plan and run the chapter's semester of social events. They use it in short, frequent sessions, on both desktop (planning sessions) and phone (checking the calendar or budget on the go, at an event, or mid-conversation with another chapter's social chair). No technical background assumed; officers turn over every semester, so the tool must stay legible to a brand-new user with no handoff notes.

## Product Purpose

A shared social calendar and budget tracker built around one specific planning workflow: scheduling co-hosted social events (mixers, formals, philanthropy, date nights) against a semester budget cap, tracking per-event expected vs. actual spend, managing a supply/equipment wishlist that carries over between semesters, and keeping a log of other orgs' social chairs and where things stand with each one. Success is an exec board that can see its whole semester, its budget health, and its outstanding social commitments at a glance, without a spreadsheet.

## Positioning

Not a generic calendar app with the labels swapped. It's shaped by the actual mechanics of Greek social planning that a generic tool has no concept of: same-day event conflict detection by severity, co-host budget netting, category-level budget exclusions (recruitment, other orgs' events), and a supply calculator with autofill presets per event category.

## Operating Context

- Deployed one instance per chapter via a one-click Vercel template (README-documented flow); each chapter runs its own copy against its own Upstash Redis database.
- Gated by a single shared passcode for the whole exec board — no per-user accounts, because officers turn over and accounts would need constant upkeep.
- Every chapter fully rebrands their instance from inside the app itself (Settings tab): chapter name, primary/accent/ink colors, and semesters are all runtime data, not code. First-run setup walks a new deployment through naming its first semester and its budget.
- A semester is the core unit of organization; officers add a new one each term and the app carries relevant state (equipment wishlist, unbought items) forward.
- Read on a phone at a party or in a hallway conversation as often as it's edited at a desk during planning.

## Capabilities and Constraints

- Calendar (month/week grid), Budget (spend tracking + equipment wishlist), Contacts (other orgs' social chairs), Categories (user-owned, colorable), Autofill (drink/supply presets per category), Settings (branding, passcode, semesters), plus first-run Setup and passcode Login.
- Every deployment's brand colors are CSS custom properties (`--color-brand-primary`, `--color-brand-accent`, `--color-brand-accent-deep`, `--color-brand-ink`) that a chapter overrides at runtime from Settings. Any new visual system must read as intentional and coherent across a wide range of chapter color pairs (school colors run the full spectrum: navy/gold, crimson/white, green/white, etc.), not just the current default blue/amber demo palette. The demo default itself is free to change.
- No chapter-specific brand assets exist in the repo (no crest, no logo) — the current template is intentionally generic so any chapter can drop in and rebrand. Greek-life visual language (letters, crests, formal-invite conventions) is fair creative material, but nothing chapter-specific should be hardcoded as if it were universal.
- Self-hosted by non-engineers; officers manage the whole app (content and settings) without touching code after the initial deploy.

## Brand Commitments

None fixed. "Greek Social Calendar" is the template's own project name (repo, README), not a name any deployment is bound to keep — each chapter sets its own `appTitle` from Settings.

## Evidence on Hand

No demo content, screenshots, testimonials, or chapter-specific assets exist in the repo today. `src/lib/seed.js` provides example events used only for the optional first-run demo-data checkbox.

## Product Principles

- Legible to a brand-new officer on day one; no tribal knowledge required to read the calendar or budget.
- Fast at a glance: conflicts, budget health, and outstanding contacts should be scannable, not something you dig for.
- The chassis is neutral; the chapter's own colors are the brand. Design for looking good and *distinct* across many different color pairs, not for one fixed palette.
- Built for real planning mechanics (conflicts, netting, carryover), not decorated around a generic calendar.
- Works equally at a desk mid-planning and one-handed on a phone at an event.

## Accessibility & Inclusion

No project-specific requirement established beyond standard web accessibility (keyboard operable, sufficient contrast against arbitrary chapter-chosen colors — the app already computes contrast-safe text color per category, see `src/lib/color.js`).
