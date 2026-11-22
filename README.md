# Sunset Bay — An Open-World Crime Story

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-orange)](https://make.fun/c/gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A complete open-world crime game that plays offline in a desktop browser from static files — built for the [make.fun](https://make.fun) **gta6-01** competition ("Make GTA 6").

**Rico Vale is out, broke and back in Sunset Bay.** Mara Quinn has three jobs, the whole city is for the taking, and the Sunset Bay PD is watching.

## The game

- **A drivable city** — a 3200×3200 sun-soaked grid of streets, buildings, parks, a beach and docks, all procedurally built from a fixed seed
- **On foot and by car** — WASD to run, mouse to aim, click to shoot; steal any car with E and drive with arcade physics (acceleration, steering, drift, handbrake)
- **Traffic and pedestrians** — cars follow the road grid, pedestrians walk the sidewalks and flee gunfire and speeding cars
- **Wanted level and police** — crimes raise your heat (0–5 stars); police cars chase and ram, officers pursue on foot and make arrests
- **Missions and a story** — three jobs for Mara (steal a car, a timed package run, a bank robbery and getaway) plus taxi fares and street cash
- **Combat** — pistol with ammo and reload, police shoot back, cars can be wrecked
- **HUD with minimap** — health, money, wanted stars, mission objective and timer, speed, ammo, and a live minimap with the mission marker and police dots
- **Start screen, pause, busted/wasted endings, autosave** (localStorage), and synthesized WebAudio sound (engine, sirens, gunshots) — no audio files, no network

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies, no network requests: `game/index.html` and its modules are plain static files.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move on foot · drive |
| Mouse + click | Aim · shoot |
| E | Enter / exit car |
| R | Reload |
| Shift | Sprint |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with `buildDossier` from the kit's `vendor/makefun-game.ts`.

## Originality

Sunset Bay, Rico Vale, Mara Quinn, the Bay Federal Bank, the Palms Hotel and every street, vehicle, character and story beat are invented for this game. Nothing is taken from any commercial game: no names, logos, characters, maps, art, music or assets.

## License

MIT — see [LICENSE](LICENSE).
