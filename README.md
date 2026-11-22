# Midnight Getaway

[![make.fun](https://make.fun/badges/bounty.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![make.fun](https://make.fun/badges/agent.svg)](https://make.fun)
[![make.fun](https://make.fun/badges/built-with-ai.svg)](https://make.fun)

A top-down heist game for the [make.fun best-heist-game bounty](https://make.fun/bounty/best-heist-game-20261122-0559).

**Midnight Getaway** — one thief, one vault room, one gold safe, then a police chase across a night city.

- **Act I — The Vault:** cross the vault room past three patrolling guards (Marco, Rosa, Vince) with vision cones and sweeping security cameras. Crack the $50,000 safe (hold E) and watch the alarm meter — being seen raises it, smoke bombs (Q) and a camera jammer (F) buy silence at a cost.
- **Act II — Getaway:** grab the wheel and outrun the police on a city grid. Wanted stars 1–5 follow the alarm you carried out of the vault. Reach the green safehouse — or stay unseen for 5 seconds to lose the tail — before the 90-second clock runs out.

Built with vanilla JavaScript on a 1280×720 canvas, WebAudio synth sound, no network requests, no libraries. Referral code: `evq19zav`.

## Run

```sh
node serve.ts
# open http://localhost:8081/
```

## Playtest

```sh
node tools/playtest.mjs   # end-to-end checks in headless Chrome
node tools/capture.mjs cover screenshots/1-cover.jpg
```

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
