# Eventify

A shared social calendar and budget tracker for a fraternity or sorority's exec board. Built around one chapter's actual planning workflow (categories, co-hosted events, a semester budget cap), not a generic calendar app with the labels swapped.

## Features

- **Calendar**: month-grid view of the semester, with conflict detection that flags same-day time overlaps by severity.
- **Budget**: running totals (Expected Spend, Actual Spend) against a semester cap, entered per event. There's also an equipment wishlist that carries unbought items forward from one semester to the next.
- **Contacts**: a per-semester list of other orgs' social chairs and where things stand with each one.
- **Categories**: event categories (Mixer, Formal, Philanthropy, etc.) are data you own, not hardcoded. Add, edit, recolor, or delete them from the Categories tab without touching any code.
- **Drink & supply calculator**: per-event cost estimates, with an "Autofill" button that pulls from editable presets per category. The whole catalog — drink groups, items, prices — is yours to edit from the Drinks tab.
- **Calendar export**: a one-time `.ics` export of your chapter's own hosted events.
- **Passcode-gated access**: one shared passcode for the whole exec board. No per-user accounts to manage, and you can change it from the Settings tab when officers turn over.
- **Settings you own**: chapter name, colors, semesters, and the passcode are all editable in the app. After the initial deploy you never need to touch your hosting dashboard again.

## Deploy your own instance

You don't need to write code or open a terminal for this. Grab two free accounts, [GitHub](https://github.com/signup) and [Vercel](https://vercel.com/signup), and you're set. Vercel lets you sign up with GitHub in one click, so this takes about thirty seconds.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcolegonya%2Feventify&env=SITE_PASSCODE&envDescription=A%20shared%20login%20passcode%20for%20your%20exec%20board.%20Your%20chapter%20name%20and%20colors%20are%20set%20from%20inside%20the%20app%20after%20it%20deploys.&envLink=https%3A%2F%2Fgithub.com%2Fcolegonya%2Feventify%23environment-variables&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22upstash%22%2C%22productSlug%22%3A%22upstash-kv%22%2C%22protocol%22%3A%22storage%22%7D%5D)

1. **Click the button above.** Vercel asks you to sign in with GitHub, then copies this code into a new repository under your own account and starts setting up a matching Vercel project. Nothing here touches the original repo.
2. **Confirm the database.** The same setup screen prompts you to create an Upstash (Redis) database as part of this same flow — no separate trip to a Storage tab needed. Accept the defaults it offers. You don't need your own Upstash account or any API keys for this part.
   - If for some reason it doesn't prompt you automatically: on your new project, go to Storage → Create Database → Upstash, and follow its prompts instead.
3. **Fill in the one environment variable it asks for.**
   - `SITE_PASSCODE`: pick anything. This is what your exec board types in to log in, so make it something you can drop in a group chat without an outsider guessing it.
4. **Click Deploy.** A minute or two later you'll have a live URL like `your-project.vercel.app`. That's your chapter's calendar, running for real.

Log in with the passcode you picked and the app walks you through a one-screen setup: name your semester, set its first and last day, and put in a rough budget. Check the box if you'd like it filled with example events to click around in first (they land inside the dates you chose, and you can delete them whenever). Leave it unchecked for an empty calendar.

Everything after that is editable in the app, from the **Settings** tab: your chapter name, your colors, the shared passcode, and your semesters. Add a new semester there each term.

Every push to your new repo's main branch redeploys automatically. So if you later decide to tweak the code (see [Local development](#local-development-optional) below), Vercel just picks it up.

### Environment variables

Only three of these matter, and the deploy button asks you to type in exactly one of them — the other two get filled in automatically by the Upstash step.

| Variable | Required | Description |
| --- | --- | --- |
| `SITE_PASSCODE` | Yes | Your starting login passcode. The app won't start without it. That's intentional, not an oversight. You can change the passcode later from the Settings tab, which stores the new one in your database and stops using this. |
| `UPSTASH_REDIS_REST_URL` | Yes | Where your data (events, budget, contacts) actually lives. Auto-filled by the Upstash step (step 2 above). |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Access token for that same database. Also auto-filled by the Upstash step. |
| `NEXT_PUBLIC_CHAPTER_NAME` | No | Starting chapter name, if you'd rather not type it in the app. Defaults to `Blank`. Editable in Settings. |
| `NEXT_PUBLIC_BRAND_PRIMARY`, `NEXT_PUBLIC_BRAND_ACCENT`, `NEXT_PUBLIC_BRAND_ACCENT_DEEP`, `NEXT_PUBLIC_BRAND_INK` | No | Starting brand colors (hex). Leave unset for the default palette. Editable in Settings. |

The last two rows are defaults, not settings. Anything you save in the app wins over them, so there's no need to keep them in sync.

## Customizing for your chapter

All of this is done in the running app. No code edits, no redeploys.

- **Name and colors**: the Settings tab. Pick colors with a swatch picker or paste hex codes; leave a color blank for the default.
- **Passcode**: the Settings tab. Changing it signs out every other browser, which is what you want when officers turn over. You stay signed in.
- **Semesters**: the Settings tab, or "Add or edit semesters…" in the semester dropdown on the Calendar and Budget tabs. Add one each term, rename them, move their dates, or delete one (which deletes its events, game days, and contacts too).
- **Event categories**: the Categories tab. Add, rename, recolor, or delete them as you like. Each category can also be marked as netting revenue (cost offset by income, like a philanthropy event), excluded from the budget total (Recruitment, say), or flagged as another org's event (kept out of your budget and calendar export).
- **Drinks & supply catalog**: the Drinks tab — drink groups and items with prices, plus each category's typical autofill quantities.

If you'd rather change the *default* palette in code, edit `src/app/globals.css` (`--color-brand-primary`, `--color-brand-accent`, `--color-brand-ink`, etc.) — that needs the local dev setup below.

## Local development (optional)

You only need this if you actually want to edit the code, say to change colors or add a feature. Just running your own instance doesn't require any of it.

### 1. Clone and install

```bash
git clone <your-repo-url>
cd eventify
npm install
```

`<your-repo-url>` is whatever repo Vercel created for you in step 1 above, or your own fork.

### 2. Configure environment variables

Copy the example file and fill it in, reusing the values from your Vercel project (Settings → Environment Variables) or pointing at a separate test database:

```bash
cp .env.example .env.local
```

The [environment variables](#environment-variables) table above covers what each value is and where to find it. Want a separate database for local testing instead of your production one? Create a free one at [upstash.com](https://upstash.com) and copy its REST URL and token.

### 3. Run it locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your passcode.

## License

MIT. See [LICENSE](LICENSE).
