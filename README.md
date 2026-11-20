# gta6-01-r4

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/targammm/gta6-01-r4/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/targammm/gta6-01-r4/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an original open-world crime game in the browser: Rico Vale returns to a sun-soaked coastal city to run three jobs for the fixer Mara — moving a package, outrunning the Solmar Bay PD, and taking the harbour back from the Vipers. Explore on foot or steal any car, build a wanted level up to five stars, and try to keep the whole city from coming down on you.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## How to play

You are Rico Vale. The city is 420 metres square — four districts, a marina, a harbour and a beach — and everything in it is live: traffic cruises the avenues, pedestrians stroll the sidewalks, and the Solmar Bay PD responds to what you do.

**The three jobs** (they chain automatically, and your progress is saved):

1. **Package Run** (+$400, +100 XP) — pick up Mara's package at the Marina and deliver it to Downtown.
2. **Heat Escape** (+$600, +150 XP) — the drop was watched: lose the cops completely, then reach the hideout under Coral Bridge.
3. **Harbor Showdown** (+$1,000, +250 XP) — clear the harbour of all 3 Vipers and take their cut.

**Wanted system.** Stealing a car earns a star; shooting, running people down and killing Vipers earn more, up to five. Cruisers spawn to match your level and will ram you, or bust you if they pin you on foot. Stay out of trouble — and out of sight — and the level cools down.

**Police helicopter.** At wanted level 4–5 a police helicopter joins the chase: it hovers above you with a spotlight, and while it is overhead your wanted level will not cool down. Break line of sight and drop below three stars to shake it off.

**Controls:** WASD/arrows move · mouse look · E enter/exit car · F or click shoot · V punch · Space jump/brake · Shift sprint · P pause · R restart mission · M mute.

Everything is procedural — the city, the cars, the sound (WebAudio synthesis, no audio files) — and the game is plain static files with three.js vendored alongside; there is no build step and nothing is fetched at runtime.

<sub>Entered on [make.fun](https://make.fun/?ref=c5ppnbr2&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
