# AccessAll

AccessAll is an Expo accessibility community app. People can report barriers, track progress,
vote on issues, review the accessibility of places, and find places on an interactive map.

## Run locally

`.env` is not in version control, so create it first:

```powershell
copy .env.example .env
```

Then **edit `.env`** and replace the two placeholder values with your Supabase project URL and
publishable key — see [Connecting a Supabase project](#connecting-a-supabase-project). The app
refuses to start on the unedited placeholders and tells you so, rather than failing later with
network errors.

```powershell
npm ci
```

```powershell
npm run web
```

Metro prints `env: load .env` on startup. If it does not, `.env` is missing or in the wrong
directory, and the app shows an "AccessAll is not configured" screen instead of a stack trace.

### After pulling changes

```powershell
npm ci
```

`npm ci` rather than `npm install`: it installs exactly what `package-lock.json` pins, so
everyone on the team runs identical versions.

If you already have an iOS or Android development build, **regenerate it** whenever native
dependencies change — a stale binary will crash on launch because the JavaScript references a
native module the build does not contain. Web needs no rebuild.

```powershell
npx expo prebuild --clean
```

MapLibre contains custom native code, so Android and iOS require an Expo development build;
it is not available in Expo Go.

```powershell
npx expo prebuild
npx expo run:android
# or: npx expo run:ios
```

Create an account from the **Profile** tab the first time you run it.

## What makes AccessAll different

- **My access profile** — people choose their needs (wheelchair, temporary injury, blind or low
  vision, Deaf or hard of hearing, sensory sensitive). Every place then shows how well it fits
  *them*, "confirmed" vs "not confirmed yet", and Explore can sort and filter by fit.
- **Report → letter → fix** — any open report can be turned into a formal letter to school staff
  (evidence, people affected, Section 504 / ADA framing, a dated request for a reply). School
  staff accounts can post updates with a note and photo proof; everyone affected is notified.
- **Impact dashboard** — barriers reported, fixed, people affected, median days to fix, and the
  most urgent open barriers, live.
- **Measured quiet scores** — reviewers can measure noise with the microphone for 10 seconds
  instead of guessing. Nothing is recorded or uploaded; only the level is kept.
- **Step-free directions** — community-written, step-by-step routes through a building, each
  step with an optional photo.
- **Live subway elevator outages** — when the map shows New York City, Explore shows elevators
  out of service right now as map pins (with toggles for places, open barriers and outages) and
  as a list with the MTA's suggested alternative.
- **Safe for students** — anyone can report a comment, review, report or set of directions;
  three reports hide it until staff decide; people can block each other. Every change to a
  place's access details is logged and staff can undo it.
- **Landing page and onboarding** — signed-out web visitors land on a live night-map of the city
  (`src/components/landing`); phones get a four-step walkthrough on first launch.

## Database

AccessAll stores everything in a shared Postgres database on Supabase, so contributions from
one person are visible to everyone. Accounts are Supabase Auth users; the app never handles
password material itself.

- **Schema** lives in [`supabase/migrations`](supabase/migrations) and is the source of truth.
  Apply the files in order to a fresh project (SQL Editor, or `supabase db push` with the CLI).
- **Access control** is row level security, enabled on every table. Reviews, reports, places
  and comments are world-readable but writable only as yourself; settings and the activity feed
  are private to their owner. Aggregate columns (`places.rating`, `reports.upvotes`,
  `polls.vote_count`) are maintained by triggers and are not writable through the API, so
  ratings and vote counts cannot be forged by a client. Column grants also decide what each
  insert may set (`0006`): email addresses are not readable through the API, a place's name,
  coordinates and source link are fixed once created (only its guide and features are
  community-editable, with the guide author stamped by a trigger), new reports and polls must
  carry coordinates, and polls refuse votes after they close.
- **Notifications** are rows in the activity feed written by triggers (`0007`) when someone
  comments on your report or a report you follow changes status. They respect the
  notification switches in Settings; `user_settings.activity_seen_at` drives the unread badge.
- **Access features** (`0009`): `user_settings.access_needs`, the `staff_members` table and
  `staff_update_report` function, `reports.resolved_at`, the `impact_summary` view,
  `reviews.quiet_measured`, `place_directions`, and a public `photos` storage bucket that each
  user may only write into their own folder.
- **Privacy and abuse limits** (`0010`): other people see only "First L."; last names,
  school and who voted for what are private; per-user rate limits on everything that can be
  posted; a report's wording locks once others have backed it.
- **Moderation and history** (`0011`): `content_reports`, `user_blocks`, `hidden_at` on
  user content, the `moderation_queue` view and `moderate_content` / `revert_place_edit`
  functions for staff, and `place_edits`.
- **Account deletion** is the `delete_my_account` function (`0008`). Reports and places the
  person created stay, without their name.
- **Geography** uses PostGIS. `places.location` is a generated point with a GiST index; the
  `places_nearby` and `places_in_bounds` functions serve map queries from that index rather
  than scanning latitude/longitude columns. Reports and polls carry the same shape: their
  location is confirmed against the geocoder in the composer, so the coordinates stored with
  it are real. Rows written before migration `0005` have null coordinates — their location is
  unverified text and cannot be mapped.
- **Configuration** is two `EXPO_PUBLIC_` variables in `.env` — see `.env.example`. Both are
  publishable values that are meant to ship in the client bundle. The database password and
  any `sb_secret_*` key bypass row level security and must never appear in this repo.

### Connecting a Supabase project

1. Create a project, then run the files in `supabase/migrations` in order.
2. Copy `.env.example` to `.env` and fill in the project URL and publishable key from
   **Project Settings → API Keys**.
3. Under **Authentication → Sign In / Providers**, decide whether **Confirm email** should be
   on. It is currently **off** so accounts work immediately for testing. Turn it back on before
   any real launch, and configure a custom SMTP sender — the built-in one is rate limited and
   intended for development only.
4. Under **Authentication → URL Configuration**, set the **Site URL** to where the web app is
   served and add both `<site>/auth` and `accessall://auth` to **Redirect URLs**, so password
   reset and email confirmation links land back in the app (web and phone). Links use PKCE, so
   an intercepted link is useless without the device that asked for it. Also turn on
   **Secure password change** under Authentication → Providers → Email.
5. Make school staff accounts in the SQL Editor (the app cannot grant this):
   `insert into public.staff_members (user_id, title) values ('<auth user id>', 'Assistant Principal');`
6. Run [`supabase/tests/rls_smoke_test.sql`](supabase/tests/rls_smoke_test.sql) in the SQL
   Editor. Every row should read `ok = true`; it rolls back and leaves nothing behind.

## Maps

- There is no bundled place dataset. Search the map, then use **Add this place to AccessAll**
  to contribute a location. Accessibility details, ratings, and sensory scores come from
  community reviews.
- Filing a report or proposing a vote requires picking the location from the geocoder's
  suggestions. Free text is deliberately not accepted: it cannot be placed on a map, and two
  spellings of one doorway would otherwise become two unrelated records.
- Detailed map tiles come from OpenStreetMap and require no API key. Follow the OSM tile
  usage policy and move to a dedicated or self-hosted tile service before high-volume use.
- Worldwide place search uses the open-source Photon geocoder. Set
  `EXPO_PUBLIC_GEOCODER_URL` to a self-hosted Photon endpoint for production traffic.
- OpenStreetMap/OpenMapTiles/OpenFreeMap attribution is displayed on the map.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npx expo export --platform web
```

The same lint, typecheck and test steps run in GitHub Actions on every push and pull request.
