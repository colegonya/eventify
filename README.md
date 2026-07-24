# Greek Social Calendar

A shared social calendar and budget tracker for a fraternity or sorority's exec board — built for one chapter's actual planning workflow (categories, co-hosted events, a semester budget cap) rather than a generic calendar app.

## Features

- **Calendar** — month-grid view of the semester's events, with conflict detection (same-day time overlaps) flagged by severity.
- **Budget** — running totals (Expected Spend, Actual Spend) against a semester budget cap, entered per event. Includes an equipment wishlist that carries unbought items forward semester to semester.
- **Contacts** — per-semester list of other orgs' social chairs and their outreach status.
- **Categories** — event categories (Mixer, Formal, Philanthropy, etc.) are data you own, not hardcoded. Add, edit, recolor, or delete them from the Categories tab — no code changes required.
- **Drink & supply calculator** — per-event cost estimate with an "Autofill" button pulling from editable presets per category.
- **Calendar export** — one-time `.ics` export of your chapter's own hosted events.
- **Passcode-gated access** — one shared passcode for the whole exec board; no per-user accounts.

## Setup

### 1. Clone and install

```bash
git clone <your-fork-url>
cd greek-social-calendar
npm install
```

### 2. Provision a Redis database

Data is stored in Upstash Redis (Vercel's current recommended key-value store — "Vercel KV" is deprecated). Easiest path: create your Vercel project first (see [Deploying](#deploying-to-vercel) below), then add the **Upstash** integration from the Vercel Marketplace — it provisions a database and injects the two env vars below automatically.

If you'd rather set it up before deploying, create a free database directly at [upstash.com](https://upstash.com) and copy its REST URL and token.

### 3. Configure environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | From your Upstash database's REST API section. |
| `UPSTASH_REDIS_REST_TOKEN` | From the same place. |
| `NEXT_PUBLIC_CHAPTER_NAME` | Your chapter's name, e.g. `Alpha Beta`. Shows up as "Alpha Beta Social Calendar" throughout the app. Defaults to `Blank` if unset. |
| `SITE_PASSCODE` | The shared passcode your exec board uses to log in. The app refuses to start without this set — there's no default. |

### 4. Run it locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in with the passcode you set, and you'll land on a pre-seeded example semester. Everything in it (events, contacts, categories) is fictional placeholder data — edit or delete it from the Calendar, Contacts, and Categories tabs once you're ready to enter your own.

## Deploying to Vercel

1. Push this repo to your own GitHub account.
2. In Vercel, click **Add New → Project** and import that repo.
3. Before the first deploy, add the **Upstash** integration (Vercel Marketplace) to the project, or add the two `UPSTASH_REDIS_REST_*` variables manually if you provisioned Upstash yourself.
4. Add `NEXT_PUBLIC_CHAPTER_NAME` and `SITE_PASSCODE` under Project Settings → Environment Variables.
5. Deploy. Every push to your main branch redeploys automatically.

## Customizing for your chapter

- **Name:** set `NEXT_PUBLIC_CHAPTER_NAME` (see above) — no code edit needed.
- **Colors:** edit the CSS variables (`--color-brand-primary`, `--color-brand-accent`, `--color-brand-ink`, etc.) in `src/app/globals.css`.
- **Event categories:** manage entirely from the in-app **Categories** tab — add, rename, recolor, or delete. Each category can also be marked as netting revenue (cost is offset by income, e.g. a philanthropy event), excluded from the budget total (e.g. Recruitment), or flagged as another org's event (excluded from your budget and calendar export).
- **Drink & supply presets:** managed from the **Autofill** tab, per category.

## License

MIT — see [LICENSE](LICENSE).
