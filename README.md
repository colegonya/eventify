# Greek Social Calendar

A shared social calendar and budget tracker for a fraternity or sorority's exec board. Built around one chapter's actual planning workflow (categories, co-hosted events, a semester budget cap), not a generic calendar app with the labels swapped.

## Features

- **Calendar**: month-grid view of the semester, with conflict detection that flags same-day time overlaps by severity.
- **Budget**: running totals (Expected Spend, Actual Spend) against a semester cap, entered per event. There's also an equipment wishlist that carries unbought items forward from one semester to the next.
- **Contacts**: a per-semester list of other orgs' social chairs and where things stand with each one.
- **Categories**: event categories (Mixer, Formal, Philanthropy, etc.) are data you own, not hardcoded. Add, edit, recolor, or delete them from the Categories tab without touching any code.
- **Drink & supply calculator**: per-event cost estimates, with an "Autofill" button that pulls from editable presets per category.
- **Calendar export**: a one-time `.ics` export of your chapter's own hosted events.
- **Passcode-gated access**: one shared passcode for the whole exec board. No per-user accounts to manage.

## Deploy your own instance

You don't need to write code or open a terminal for this. Grab two free accounts, [GitHub](https://github.com/signup) and [Vercel](https://vercel.com/signup), and you're set. Vercel lets you sign up with GitHub in one click, so this takes about thirty seconds.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcolegonya%2Fgreek-social-calendar&env=NEXT_PUBLIC_CHAPTER_NAME,SITE_PASSCODE&envDescription=Your%20chapter%20name%20and%20a%20shared%20login%20passcode%20for%20your%20exec%20board.&envLink=https%3A%2F%2Fgithub.com%2Fcolegonya%2Fgreek-social-calendar%23environment-variables)

1. **Click the button above.** Vercel asks you to sign in with GitHub, then copies this code into a new repository under your own account and starts setting up a matching Vercel project. Nothing here touches the original repo.
2. **Add a database.** Same setup screen: find Storage, click Create Database, choose Upstash (Redis), and follow its prompts. It provisions the database and wires it up on its own. You don't need your own Upstash account or any API keys for this part.
3. **Fill in the two environment variables it asks for.**
   - `NEXT_PUBLIC_CHAPTER_NAME`: your chapter's name, e.g. `Alpha Beta`. Shows up as "Alpha Beta Social Calendar" throughout the app.
   - `SITE_PASSCODE`: pick anything. This is what your exec board types in to log in, so make it something you can drop in a group chat without an outsider guessing it.
4. **Click Deploy.** A minute or two later you'll have a live URL like `your-project.vercel.app`. That's your chapter's calendar, running for real.

Log in with the passcode you picked and you'll land on a pre-seeded example semester. All of it, events, contacts, categories, is made up. Clear it out and replace it with your own whenever you get around to it; there's no rush.

Every push to your new repo's main branch redeploys automatically. So if you later decide to tweak the code (see [Local development](#local-development-optional) below), Vercel just picks it up.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_CHAPTER_NAME` | Yes | Your chapter's name. Defaults to `Blank` if unset, so it's obvious setup isn't finished. |
| `SITE_PASSCODE` | Yes | The shared login passcode. The app won't start without it. That's intentional, not an oversight. |
| `UPSTASH_REDIS_REST_URL` | Yes | Where your data (events, budget, contacts) actually lives. Auto-filled if you add the Upstash integration during setup (step 2 above). |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Access token for that same database. Also auto-filled by the Upstash integration. |
| `NEXT_PUBLIC_BRAND_PRIMARY`, `NEXT_PUBLIC_BRAND_ACCENT`, `NEXT_PUBLIC_BRAND_ACCENT_DEEP`, `NEXT_PUBLIC_BRAND_INK` | No | Optional brand colors (hex). Leave unset to use the shared default palette; set these on your own project if you want your instance's colors to differ without editing code. |

## Customizing for your chapter

- **Name**: set `NEXT_PUBLIC_CHAPTER_NAME` (Vercel → your project → Settings → Environment Variables). No code edit needed.
- **Colors**: set the `NEXT_PUBLIC_BRAND_*` environment variables above to your chapter's own colors, no code edit needed. Or, if you're already in the codebase, edit the defaults directly in `src/app/globals.css` (`--color-brand-primary`, `--color-brand-accent`, `--color-brand-ink`, etc.) — that needs the local dev setup below.
- **Event categories**: handled entirely from the in-app Categories tab. Add, rename, recolor, or delete them as you like. Each category can also be marked as netting revenue (cost offset by income, like a philanthropy event), excluded from the budget total (Recruitment, say), or flagged as another org's event (kept out of your budget and calendar export).
- **Drink & supply presets**: managed from the Autofill tab, per category.

## Local development (optional)

You only need this if you actually want to edit the code, say to change colors or add a feature. Just running your own instance doesn't require any of it.

### 1. Clone and install

```bash
git clone <your-repo-url>
cd greek-social-calendar
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
