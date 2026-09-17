# Pit Wall

Pit Wall is a team hub for FIRST Tech Challenge (FTC) robotics teams — one place to manage your team account, track your robot, scout opponents, browse events with AI-generated performance analysis, keep an engineering notebook with instant AI feedback, and ask a context-aware AI assistant questions about your own team's data.

Live at **[pit-wall-digital.lbdev.tech](https://pit-wall-digital.lbdev.tech)**.

## Features

- **Demo mode** — a "Try the demo" link on the login page opens a self-contained page with realistic example data across every feature (dashboard, robot profile, scouting, schedule, events with AI analysis, AI chat, notebook, roster, checklist). No account needed, nothing is saved, and no real AI calls are made — it's plain HTML/JS with canned data, deliberately kept independent of Firebase so it works even if a visitor's network blocks Google/Firebase domains.
- **Contact form** — a no-login-required page for bug reports/feature ideas/questions, linked from the login page and Help. Posts to a Cloudflare Worker that relays it to a Discord forum thread and an email notification.
- **Light/dark theme** — follows your system setting by default; toggle it from the sidebar (or the login page) and it's remembered from then on.
- **Team accounts** — create a team (Firebase Auth + team number/name looked up live from [FTCScout](https://ftcscout.org) as you type), or join an existing one with a join code from a teammate. Everyone on a team shares the same data — robot profile, scouting log, chat, notebook, checklist — under their own individual login. Only one Pit Wall team can exist per real FTC team number — creating a second one for the same number is blocked, with a prompt to use "Join Team" instead (or contact support if nobody on the team has signed up yet). A verification link is emailed on signup (Settings shows a reminder banner and a resend button until you click it).
- **Team Roster** — see everyone signed into your team, share/regenerate the join code, and set each person's name and role. Roles are otherwise descriptive only (any member can edit or remove any other member) except one enforced rule: every team must always keep at least one Owner, so removing or demoting the last Owner is blocked until someone else is made Owner first.
- **Unsaved-changes warning** — the Robot Profile, Scouting, Engineering Notebook, and Team Info forms warn before you navigate away (back button, closing the tab, or clicking elsewhere in the app) with unsaved edits.
- **Help** — a plain-English explainer of what FTC is, an onboarding walkthrough, a glossary of terms used around the app, and answers to common questions — for anyone using Pit Wall without an FTC background.
- **Dashboard** — quick links and a snapshot of your robot profile.
- **Robot profile** — log your drivetrain, game piece mechanism, and autonomous routine; this feeds the AI chat and event analysis.
- **Scouting** — log opponent teams you see at events (drivetrain, scoring capability, driver skill, notes), with a driver-skill chart and CSV export.
- **Schedule** — pulls your team's match schedule for the current season straight from FIRST's official FTC Events API.
- **Events** — every event your team is registered for, past and upcoming, across multiple seasons. Pick a past event to see your record, browse **Our Matches**, **All Matches**, or the full **Teams** list, click into any match or team for a popup with everything both the FTC Events API and FTCScout API know about it, and generate AI feedback — a whole-event breakdown by Driver/Programmer/Builder, plus a quick AI comment on any individual match.
- **AI Chat** — ask questions about strategy, your robot, or the competition; the assistant is given your team, robot, scouting, and notebook data as context. Supports Markdown and LaTeX.
- **Engineering Notebook** — log session entries and get instant AI feedback on each one (shown right in the list, no need to open anything), upload photos of physical notebook pages for AI feedback, upload a finished PDF/Word notebook for a holistic AI review, or have the AI pull your robot profile and every logged session together into a complete, judge-ready notebook write-up you can download.
- **Pit Checklist** — a customisable pre-competition checklist.
- **Settings** — manage your account, team info, and chat history; see roughly how much data your team has stored (in MB) with a button to wipe it all while keeping every login, or delete just your own account (your team's shared data stays, since teammates may still need it); shows the current app version.

## Tech stack

The frontend is plain HTML/CSS/JS, no build step, no framework — but it's no longer a *pure* static site: `src/worker.js` is a real Cloudflare Worker that serves those static files AND proxies the two third-party APIs that need a server-side secret, so the site and its backend are one deployment instead of three separate ones.

| Purpose | Service |
|---|---|
| Auth + database | [Firebase](https://firebase.google.com/) (Auth + Firestore) |
| File storage (notebook photos/docs) | [Cloudinary](https://cloudinary.com/) (unsigned uploads) |
| AI chat completions | [Groq](https://groq.com/), proxied at `/api/groq` by this repo's own `src/worker.js` — the API key is a Worker secret, never sent to the browser |
| Official FTC event/team/match data | [FIRST's FTC Events API](https://ftc-events.firstinspires.org/api-docs), proxied at `/api/ftc-events` the same way |
| Community FTC stats (OPR/DPR/CCWM, team profiles) | [FTCScout API](https://api.ftcscout.org/) — public and CORS-enabled, called directly from the browser |
| Hosting + API | A single [Cloudflare Worker with static assets](https://developers.cloudflare.com/workers/static-assets/) (`wrangler deploy`, config in `wrangler.jsonc`, code in `src/worker.js`), git-connected to this repo |
| Contact form | Posts to a *separate* Cloudflare Worker ([LB-Dev-Help-Email-Discord-Webhook-API](https://github.com/Liam-burnett-AU/LB-Dev-Help-Email-Discord-Webhook-API)) that relays it to Discord + email — kept separate since it's a shared personal service, not Pit Wall-specific |

## Project structure

```
index.html                  Login / signup
demo.html                    Self-contained demo with example data — no login
contact.html                  Contact form (no login required)
dashboard.html               Team dashboard
robot-profile.html          Robot profile form
scouting.html                Opponent scouting log
schedule.html                Match schedule (current season)
events.html                   Past/upcoming events, results, AI analysis
chat.html                    AI chat
engineering-notebook.html   Notebook entries, photos, final doc review
roster.html                   Team roster — members, roles, join code
help.html                      Onboarding, glossary, FAQ
pit-checklist.html          Pit checklist
settings.html                 Account/team settings
assets/style.css              Shared design system (tokens, layout, components)
assets/app.js                 Shared config + helpers (Firebase config, nav, toasts,
                              markdown rendering, API calls) imported by every page
firestore.rules               Firestore security rules — see below
src/worker.js                   Cloudflare Worker: serves the static site + proxies Groq/FTC Events
wrangler.jsonc                 Cloudflare Worker config (entry point, static assets, secrets)
.assetsignore                  Files excluded from the public static asset upload — see Deployment
```

Every page pulls its Firebase config, third-party API helpers, toast notifications, and sidebar navigation from `assets/app.js`, and its visual design from `assets/style.css`, so there's one place to update either.

## Configuration

To run your own copy, set these in **`assets/app.js`**:

- `firebaseConfig` — your Firebase project config (this is safe to be public; real access control is enforced by `firestore.rules`, not by hiding this).
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` — your Cloudinary cloud name and an **unsigned** upload preset.
- `FTC_EVENTS_SEASON` — the season FTC Events API calls default to (e.g. `"2026"` for the 2026-2027 season).

`GROQ_PROXY_URL` (`/api/groq`) and `FTC_EVENTS_PROXY_URL` (`/api/ftc-events`) point at routes on this same Worker (`src/worker.js`) — you shouldn't need to touch these unless you change the routes. What you do need to set are the **secrets those routes read from `env`**, in the Cloudflare dashboard for your Worker (**Settings → Variables and Secrets**) or via Wrangler:

```
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put FTC_EVENTS_USERNAME
npx wrangler secret put FTC_EVENTS_API_KEY
```

Without these set, `/api/groq` and `/api/ftc-events` respond `500` with a "Server misconfigured" error rather than silently failing.

`contact.html` has its own `CONTACT_API_URL` constant (not in `assets/app.js` — this page deliberately has zero Firebase dependency, see below) pointing at a deployed instance of [LB-Dev-Help-Email-Discord-Webhook-API](https://github.com/Liam-burnett-AU/LB-Dev-Help-Email-Discord-Webhook-API), a separate Worker with its own secrets; update it to your own Worker's URL.

### Firestore rules

Every team's data collections are keyed by a `teamId`, and `firestore.rules` locks them to "only someone on that team can read or write it" — team membership is looked up from a `members/{uid}` doc mapping each signed-in person to their team. The one deliberate exception is the `teams` collection itself, which allows public reads: joining a team by code has to look up the team *before* the new member has signed in, and this project has no backend function to gate that lookup more tightly. Team name/number aren't sensitive (they're public via FTCScout anyway); writes still require being on the team. `firestore.rules` isn't deployed automatically — paste it into **Firebase Console → Firestore Database → Rules**, or run:

```
firebase deploy --only firestore:rules
```

## Deployment

No build step, deployed as a **Cloudflare Worker** (`wrangler.jsonc` → `main: "src/worker.js"`) with the whole repo root also served as static assets (`assets.directory: "."`) for anything that isn't an `/api/*` route. It's git-connected via Cloudflare's Workers Builds — push to `main` and it runs `npx wrangler deploy` automatically.

This is deliberately **not** a static-assets-only deployment (no `main` entry, just `assets`) — that mode has nowhere to hold a secret, since only actual Worker code gets an `env` with bindings/secrets on it. `src/worker.js` is what makes `GROQ_API_KEY` etc. possible at all; see Configuration above for setting them.

`.assetsignore` (gitignore-style syntax) controls what actually gets uploaded as a public static asset — **this matters**: without it, wrangler uploads *every* file under the assets directory, `.git` included, which on this project's first deploy publicly exposed the entire commit history at the live URL (`/.git/config`, `/.git/objects/*`, etc., all served as plain files). Any new top-level file/folder that shouldn't be public (config, docs, tooling, `src/`) needs adding to `.assetsignore`, not just `.gitignore` — the two lists serve different purposes and aren't interchangeable.

One-time setup for a new copy of this project (done once in the Cloudflare dashboard, not from this repo):

1. **Cloudflare dashboard → Workers & Pages → Create → Workers → Deploy via Git**, pick this repo (or connect Workers Builds from an existing Worker's Settings → Build tab).
2. Deploy command: `npx wrangler deploy` (this is what actually reads `wrangler.jsonc` and `.assetsignore`).
3. **Settings → Variables and Secrets** on the Worker → add `GROQ_API_KEY`, `FTC_EVENTS_USERNAME`, `FTC_EVENTS_API_KEY` as **Secret** type (not plain text Variables — secrets aren't shown again after saving and aren't readable from the dashboard, which is the point).
4. **Custom domains** tab on the Worker → add your domain and follow the DNS prompts (Cloudflare manages this instead of a `CNAME` file in the repo, which is a GitHub Pages convention this project no longer uses).

## Versioning

`APP_VERSION` in `assets/app.js` is shown at the bottom of the Settings page. Bump it with every change that ships — patch (`1.0.x`) for fixes/tweaks, minor (`1.x.0`) for new features, major (`x.0.0`) for a significant redesign or breaking change.

---

Built as a Digital Technologies assessment project (Sheldon College, Term 2 2026).
