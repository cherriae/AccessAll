# AccessAll

AccessAll is an Expo accessibility community app. People can report barriers, track progress,
vote on issues, review the accessibility of places, and find places on an interactive map.

## Run locally

```powershell
npm ci
npm run web
```

MapLibre contains custom native code, so Android and iOS require an Expo development build;
it is not available in Expo Go.

```powershell
npx expo prebuild
npx expo run:android
# or: npx expo run:ios
```

Demo account: `alex@example.com` / `accessall-demo`

## Data and maps

- App data, accounts, sessions, reviews, comments, and preferences are stored locally in SQLite.
- Places, reviews, reports, polls, and activity are records in the single local SQLite database;
  there is no bundled place dataset. Search the map, then use **Add this place to AccessAll** to
  contribute a location. Accessibility details, ratings, and sensory scores are added through
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
