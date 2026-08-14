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
  ratings and vote counts cannot be forged by a client.
- **Geography** uses PostGIS. `places.location` is a generated point with a GiST index; the
  `places_nearby` and `places_in_bounds` functions serve map queries from that index rather
  than scanning latitude/longitude columns.
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

## Maps

- There is no bundled place dataset. Search the map, then use **Add this place to AccessAll**
  to contribute a location. Accessibility details, ratings, and sensory scores come from
  community reviews.
- Detailed map tiles come from OpenStreetMap and require no API key. Follow the OSM tile
  usage policy and move to a dedicated or self-hosted tile service before high-volume use.
- Worldwide place search uses the open-source Photon geocoder. Set
  `EXPO_PUBLIC_GEOCODER_URL` to a self-hosted Photon endpoint for production traffic.
- OpenStreetMap/OpenMapTiles/OpenFreeMap attribution is displayed on the map.

## Checks

```powershell
npm run lint
npx tsc --noEmit
npx expo export --platform web
```
