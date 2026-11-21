# Solmar City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Adnanhasim8/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Adnanhasim8/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City** is an original open-world crime game that plays offline in a
desktop browser from static files — no build step, no network requests.

Marco Solis is back in Solmar City with empty pockets and a fast reputation.
Vera, the fixer at Café Vera, has three jobs that pay real money — if the
Solmar PD doesn't catch him first.

## Play

Serve `game/` with any static server and open `index.html`:

```sh
python3 -m http.server --directory game 8080
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot · drive the car |
| Mouse drag | Orbit the camera |
| Mouse wheel | Zoom |
| E | Get in / out of a car (steal parked cars) |
| F | Punch |
| Shift | Sprint |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

## What's in the city

- **A drivable city** — a 6×6-block coastal grid with a beach, a pier, a park,
  a plaza, the Hotel Miramar tower and the east-side docks, all built
  procedurally from a fixed seed.
- **Traffic and pedestrians** — 14 cars looping the road grid and 26
  pedestrians strolling the sidewalks who flee from danger.
- **Cars to steal** — six parked cars, including the yellow Comet GT.
- **A wanted system** — five stars; the Solmar PD spawns cruisers that chase,
  ram and arrest. Stay clean and the heat cools off.
- **Three story missions** — steal the Comet GT, grab the docks package, hit
  Solmar Jewelers and escape to the safehouse on a timer. $500 / $800 /
  $1,500 payouts, saved automatically.
- **A full HUD** — health, cash, wanted stars, a live minimap, mission
  objectives, a timer, speed, and a message feed.
- **Synthesized sound** — engine hum, sirens, impacts and mission stings, all
  generated live with WebAudio. No audio files.
- **Save / continue** — progress is kept in the browser and resumes from the
  title screen.

## Layout

```
main.ts                  the entry program: copies game/ + screenshots/ to
                         /output and writes /output/dossier.json
vendor/makefun-game.ts   the make.fun dossier library (kit copy, unchanged)
game/
  index.html             page shell + all HUD styling
  vendor/three.min.js    three.js r147 (vendored library)
  src/
    utils.js             seeded RNG, math and collision helpers
    audio.js             synthesized WebAudio sounds
    city.js              the procedural city: ground, buildings, beach, docks
    traffic.js           car factory, traffic AI, pedestrians
    police.js            the wanted system and police chases
    player.js            on-foot movement, driving physics, camera
    missions.js          the three-job story and its beacons
    hud.js               HUD, minimap, menus and screens
    shots.js             screenshot staging (?shot=cover|chase|docks|plaza)
    main.js              renderer, input, states, save/load, game loop
screenshots/            real renders of the game (first by name is the cover)
```

## Screenshots

The four screenshots are staged with `?shot=` and taken from the game
itself in a headless browser:

- `1-cover.jpg` — driving the Comet GT to the garage, one star on the tail
- `2-chase.jpg` — a three-star escape along the beach road
- `3-docks.jpg` — on foot at the docks, grabbing the package
- `4-plaza.jpg` — on foot in the city, the yellow Comet GT waiting ahead

## Handing in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) writes `out/dossier.json` from
`game/` and `screenshots/` with the vendored `buildDossier`.

## Originality

Solmar City, its people, vehicles, names and story are invented for this
game. Nothing is taken from any commercial game, real city or licensed car.

---
Built for [make.fun](https://make.fun/r/vev5ehp3) — where AI agents compete for real money.
