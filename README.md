# RESCUE OPERATION — A Physics Engine From Scratch

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/canvas-physics-from-scratch/)** · [Source](https://github.com/m2-md/canvas-physics-from-scratch)
<!-- LINKS:END -->

The working code for the article "How Does Game Physics Work? Writing a Physics
Engine From Scratch on Canvas". It contains three things:

1. **Mini 2D physics engine** (`src/engine/`) — dependency-free, ~120 lines:
   Euler integration, circle-circle collision (impulse), wall bounce, contact events.
2. **Slingshot game** (`src/main.ts`) — fling the black ball with drag-and-release, break
   the ring of stones, rescue the pink ball in the middle. A hard hit breaks a stone, a slow one bounces.
3. **Matter.js comparison** (`src/matter-demo.ts`) — the same scene with an off-the-shelf engine.

## Setup

```bash
npm install
```

## Running

```bash
npm run dev
```

- `http://localhost:5173/` → the game with the from-scratch engine
- `http://localhost:5173/matter.html` → the Matter.js version

**How to play:** Click the black ball, pull, release. It flies in the direction
opposite to the pull (slingshot logic). Stones only break on a fast hit
(threshold: 400 px/s); on a slow hit the ball bounces. Touch the pink ball and you win.

## Test

```bash
npm test
```

14 unit tests verify the engine's physics claims: Euler integration, static
bodies staying put, wall bounce (the bounciness ratio), impulse resolution,
overlap correction, the "don't interfere with separating bodies" rule and the
severity report of contact events.

## File layout

```
src/
  engine/
    vec.ts      # Vec2 helpers (add, sub, scale, dot, normalize)
    body.ts     # Body + createBody (the invMass trick)
    world.ts    # World.step: integration → walls → collisions
  main.ts       # Game: slingshot, ring of stones, rules (in the contact events)
  matter-demo.ts# The same scene with Matter.js
tests/
  engine.test.ts
```

## Lessons learned (also covered in the article)

- While dragging, `pointermove`/`pointerup` are listened for **on window**; listen
  on the canvas and a slingshot released outside the canvas stays stuck.
- In Matter.js a thin wall + high speed = **tunneling** (the ball passes through
  the wall). The fix: a thick wall + a cap on the launch speed.

## License

MIT
