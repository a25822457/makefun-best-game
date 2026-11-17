# lumen-tide

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/a25822457/makefun-best-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/a25822457/makefun-best-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Lumen Tide — an original offline browser arcade game: keep the lantern lit, gather the fallen starlight, sink the shadows that rise from the deep, and defeat the Gloomwhale at wave 10. Ten waves, blessings between waves, combos, dashing, and a victory to earn.

## What the polish pass added

- **A denser tide:** nine drifting nebula clouds, sixteen shards of the old tide, twenty-six wandering lantern motes, and three parallax star layers behind the aurora — the field is never empty now.
- **Three new foes:** the Dart (locks on, flashes, then charges), the Splitter (sinks into two quick Motes), and the Sniper (holds its distance and looses aimed shadow bolts). Waves send more of everything, and the Gloomwhale now dives in fast instead of drifting in from off-screen.
- **More feedback:** damage numbers on every hit, bigger death bursts, screen shake on heavy hits, and a best-combo tracker.
- **A richer HUD:** a wave progress bar, starlight counted against the 150 goal, a combo timer bar, a lantern fuel gauge with a flashing LOW FUEL warning at one hull, and a boss bar with the Gloomwhale's exact health. Blessing cards carry an icon badge for each blessing.
- **New screenshots:** the play shot is a busy mid-wave fight, and the third shot is the wave-10 boss fight itself.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests: `game/` is plain static files.

## How to play

- **Move** — WASD or arrow keys
- **Aim + fire** — mouse, hold to loose lantern bolts
- **Dash** — Shift or right-click (briefly untouchable)
- **Blessings** — after each cleared wave, choose one of three (click, or keys 1–3)
- **Pause / mute** — P / M

Survive all 10 waves and sink the Gloomwhale to relight the Great Lantern. Your best score is kept in the browser.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
