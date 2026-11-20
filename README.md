# gta6-01-r4

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/targammm/gta6-01-r4/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/targammm/gta6-01-r4/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is a 3D open-world crime game that runs entirely in the browser: Rico Vale works three jobs for fixer Mara across a procedurally built coastal city while the Solmar Bay PD — cruisers on the street and a police helicopter overhead at high wanted levels — tries to shut him down.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step and no dependencies: the game is static files (three.js is vendored under `game/vendor/`).

## How to play

**Story.** Rico Vale rolled back into Solmar Bay with empty pockets and a long memory. Mara has work: move her package, outrun the Solmar Bay PD, and take the harbour back from the Vipers. Three jobs stand between Rico and owning this town.

**Controls**

- `W A S D` — move / drive · `Shift` — sprint · `Space` — jump (brake in a car)
- Mouse — orbit camera · click — lock the pointer and shoot
- `E` — enter / exit a car · `F` — fire pistol · `V` — punch
- `P` — pause · `M` — mute · `R` — restart current mission

**The three missions**

1. **Package Run** (+$400, +100 XP) — drive Mara's package across town to the harbour drop before the Vipers notice.
2. **Heat Escape** (+$600, +150 XP) — the drop was watched. Lose the Solmar Bay PD: break line of sight and let your wanted stars cool off.
3. **Harbor Showdown** (+$1000, +250 XP) — the Vipers hold the harbour point. Clear them out and the bay is yours.

**Wanted system & the police helicopter.** Stealing cars, shooting, hitting pedestrians and killing Vipers raise your wanted level from 0 to 5 stars. Cruisers spawn faster and drive harder the hotter it gets. At wanted level 4–5 a **police helicopter** joins the chase: it hovers about 28 m overhead, tracks you across the city and keeps its spotlight on you — and while it has eyes on you, your wanted level cannot cool down. Break line of sight, drop below 3 stars, and it peels off. If officers pin you on foot, you are busted; lose all your health and you wake up at the hospital $200 poorer.

**World & systems**

- Procedural city: 420×420 m across five districts (Downtown, Harbor, Beachfront, Midtown, Uptown) with six window-texture variants, rooftop props, neon signage and awnings, avenues, sidewalks, palms, lamps and a beach.
- Arcade driving in five procedural car kinds (sedan, taxi, van, pickup, cruiser) with skid marks, dust and crash physics; 16 AI traffic cars and 26 pedestrians who stroll, flee and panic.
- Pistol combat with a big tracer-bright muzzle flash against Viper gunmen who advance, strafe and return fire.
- Canvas minimap with traffic, police and mission blips; localStorage save (`solmar-bay-save-v1`) keeps money, XP, missions and best score between visits.
- Fully synthesized WebAudio sound: engine, siren, gunshots, crashes, pickups and a bass-line music loop. No audio files.

<sub>Entered on [make.fun](https://make.fun/?ref=c5ppnbr2&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
