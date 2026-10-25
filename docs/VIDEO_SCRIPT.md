# AccessAll demo video: script and shot list

Target length: **2:55**. Check your competition's current rules for the exact limit, and leave a few seconds of margin.

The video follows one story: a student who uses a wheelchair, from the morning commute to getting a barrier fixed. Every feature appears once, at the moment it would matter. The code segment follows directly after, and explains how the features just shown work.

## Before you film

- Run migrations `0001`–`0013` and have **real data**: at least 5–8 reports around school, some marked fixed by a staff account (the Fix Timeline needs them), 2–3 reviewed places, and one ramp measurement. `supabase/demo/seed.sql` fills all of this in one go (run it in the SQL editor; `supabase/demo/clear.sql` removes it after filming).
- Phone: the development build installed, text size at default, Do Not Disturb on.
- Watch 2–3 subway stations in Detour Radar the day before. MTA elevator outages are live, so a disrupted station is likely; if none is out on the day, film the "all clear" state and say so.
- Record the screen at 1080p (phone: built-in screen recorder; web: OBS or the Xbox Game Bar with `Win+G`).
- Record narration separately in a quiet room and lay it over the footage. It is much easier than talking while tapping.
- Keep edits to straight cuts. Avoid zoom transitions and spinning effects: they make the video harder to follow, which the rubric marks down.

## Script

| Time | On screen | Narration |
|---|---|---|
| **0:00–0:12** | Empathy Lens. Tap **Put on the low-vision lens**: the hallway sign darkens into a tunnel. | "Find the elevator. Hard, right? For millions of people, every hallway is this hard. And the signs are the easy part." |
| **0:12–0:25** | Landing page: the night map turning, live elevator-outage pins glowing in. | "I built AccessAll: a map of the barriers nobody else tracks — broken elevators, blocked ramps, rooms too loud to think in — made by students, for everyone." |
| **0:25–0:40** | Phone. Onboarding slides, then **My access profile**: choose *Wheelchair user*. Explore: places show a fit score. | "You start by telling it what you need. From then on, every place is scored for you, not for some average visitor." |
| **0:40–0:55** | Home, **Detour Radar** card: a watched station shows *Elevator out*, with *Nearest working step-free stations* and walking minutes. | "Before school, Detour Radar checks the live MTA feed. My station's elevator is out, so it finds the nearest station that works, on my own line if it can." |
| **0:55–1:10** | Reports → **Report an issue**: pin the location, title "Ramp door won't open", submit. Second phone (or account): tap **Mark me affected**. | "At school the ramp door is jammed. I report it in fifteen seconds. Everyone it affects can back it up, so staff see how many people it's blocking." |
| **1:10–1:25** | Place page → **Ramp check** → lay the phone on a real ramp → result card *9.6% · 1:10 — Slightly steeper than the ADA limit*. | "And here's something no other accessibility app does: lay your phone on a ramp, and the motion sensor measures its slope against the ADA's one-in-twelve limit. 'It feels steep' becomes evidence." |
| **1:25–1:35** | Same page → **Measure noise with microphone** → quiet score. Then **Step-free directions** with a photo step. | "The microphone measures how loud a room is for students with sensory needs, and step-by-step photo directions show the way in without stairs." |
| **1:35–1:45** | Report page → **Write the letter for me** → staff account sets Status to resolved, adds **Photo of the fix**, taps **Post update**. | "One tap writes a letter to the school using the report's data. When staff fix it, they post photo proof, and everyone who backed it is notified." |
| **1:45–2:30** | **Code segment** (see below). Screen: VS Code with each file, the key lines highlighted. | See *How the code works*. |
| **2:30–2:45** | Impact → **Fix Timeline** → press play: amber pins appear over the weeks and turn green. Counters climb. | "Every report, replayed. Amber when reported, green when fixed. This is our school's last month: [N] barriers reported, [N] fixed." |
| **2:45–2:55** | Empathy Lens: the colour-blindness board switching to the AccessAll version. End card: logo + "Every doorway should open for everyone." | "Accessibility isn't a feature. It's whether you get in the door. AccessAll makes sure someone notices, and someone fixes it." |

## How the code works (2:30 → 45 seconds)

Show each file for about 10 seconds with the named lines highlighted. Say it in your own words; these are the points to hit.

1. **Architecture** (`README.md` diagram or the folder tree). "It's React Native with Expo, so one TypeScript codebase runs on iPhone, Android and the web. The data lives in Supabase, a Postgres database."
2. **Security** (`supabase/migrations/0013_slope_and_radar.sql`, the `create policy` lines). "The rules live in the database itself, as row-level security. Even if someone edits the app, Postgres will only let you write your own measurements, and the test file proves it."
3. **Sensor physics** (`src/lib/slope.ts`, `tiltDegrees`). "A phone at rest only feels gravity. Lying on a ramp, its z-axis tilts by exactly the ramp's angle, so the angle is the arc-cosine of z over the total. I wait for 1.5 seconds of steady readings before locking a result, and the community figure is a median, so one bad measurement can't skew it."
4. **Live data** (`src/lib/transit.ts` header comment and `src/lib/detour.ts`, `findAlternatives`). "The MTA's outage feed has no coordinates, so I join three public datasets by equipment and station-complex ID. Then Detour Radar ranks step-free stations by walking distance, treating a shared train line as worth 500 metres."
5. **Testing** (terminal: `npm test` showing 39 passing). "The core logic has 39 unit tests: slope maths, colour-blindness simulation, outage joins and the timeline."

## Shot checklist

- [ ] Empathy Lens: low vision (cold open), colour board (closing)
- [ ] Landing page with live pins
- [ ] Onboarding + access profile + fit score in Explore
- [ ] Detour Radar (home card and the Radar screen)
- [ ] Report a barrier + "this affects me"
- [ ] Ramp check on a real ramp
- [ ] Sound meter + step-free directions
- [ ] Advocacy letter + staff fix with photo
- [ ] Code: architecture, RLS, slope.ts, detour.ts, tests
- [ ] Fix Timeline replay + impact numbers
- [ ] End card

## Accuracy notes

- "Up to 1 in 4 adults in the U.S. has a disability" is from the CDC; say "CDC" if you use the figure on screen.
- The ADA limit for a ramp is a 1:12 slope (8.33%), from the 2010 ADA Standards §405.2.
- Say the noise score is *measured with a phone*, not "decibels": phone microphones are not calibrated.
