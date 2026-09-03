import { describe, it, expect } from "vitest";
import {
  vec,
  add,
  sub,
  scale,
  length,
  dot,
  normalize,
} from "../src/engine/vec";
import { createBody } from "../src/engine/body";
import { World } from "../src/engine/world";

describe("vec: the alphabet of physics", () => {
  it("basic operations work correctly", () => {
    expect(add(vec(1, 2), vec(3, 4))).toEqual(vec(4, 6));
    expect(sub(vec(3, 4), vec(1, 2))).toEqual(vec(2, 2));
    expect(scale(vec(2, 3), 2)).toEqual(vec(4, 6));
    expect(length(vec(3, 4))).toBe(5);
    expect(dot(vec(1, 0), vec(0, 1))).toBe(0); // dot product of perpendiculars is 0
  });

  it("normalize keeps the direction and brings the length down to 1", () => {
    const n = normalize(vec(10, 0));
    expect(n).toEqual(vec(1, 0));
    expect(length(normalize(vec(3, 4)))).toBeCloseTo(1);
    expect(normalize(vec(0, 0))).toEqual(vec(0, 0)); // zero vector is safe
  });
});

describe("body: the invMass trick", () => {
  it("static bodies have an invMass of 0", () => {
    expect(createBody(0, 0, 10, { static: true }).invMass).toBe(0);
  });

  it("a big ball is heavy (its invMass is smaller)", () => {
    const small = createBody(0, 0, 10);
    const big = createBody(0, 0, 40);
    expect(big.invMass).toBeLessThan(small.invMass);
  });
});

describe("gravity: a two-line universe (Euler integration)", () => {
  it("a body falls: velocity and position increase", () => {
    const world = new World(800, 600, 900);
    const b = world.add(createBody(400, 100, 10));
    world.step(1 / 60);
    expect(b.vel.y).toBeCloseTo(900 / 60);
    expect(b.pos.y).toBeGreaterThan(100);
  });

  it("a static body does not fall", () => {
    const world = new World(800, 600, 900);
    const s = world.add(createBody(400, 100, 10, { static: true }));
    world.step(1);
    expect(s.pos.y).toBe(100);
    expect(s.vel.y).toBe(0);
  });
});

describe("walls: geometry first, velocity second", () => {
  it("bounces off the right wall in proportion to bounciness", () => {
    const world = new World(800, 600, 0); // no gravity, isolated test
    const b = world.add(createBody(795, 300, 10, { bounciness: 0.6 }));
    b.vel = vec(100, 0);
    world.step(1 / 60);
    expect(b.pos.x).toBe(800 - 10); // pushed back inside
    expect(b.vel.x).toBeCloseTo(-100 * 0.6); // reversed direction + damping
  });

  it("does not end up jittering on the floor: the position is corrected", () => {
    const world = new World(800, 600, 900);
    const b = world.add(createBody(400, 595, 10, { bounciness: 0 }));
    for (let i = 0; i < 120; i++) world.step(1 / 60);
    expect(b.pos.y).toBeCloseTo(600 - 10, 0); // comes to rest on the floor
  });
});

describe("collision: the impulse calculation", () => {
  it("equal balls in a head-on collision swap direction", () => {
    const world = new World(2000, 600, 0);
    const a = world.add(createBody(490, 300, 20, { bounciness: 1 }));
    const b = world.add(createBody(530, 300, 20, { bounciness: 1 }));
    a.vel = vec(100, 0);
    b.vel = vec(-100, 0);
    world.step(1 / 60);
    expect(a.vel.x).toBeLessThan(0); // now going left
    expect(b.vel.x).toBeGreaterThan(0); // now going right
  });

  it("a ball hitting a static body bounces, the static body does not budge", () => {
    const world = new World(2000, 600, 0);
    const ball = world.add(createBody(470, 300, 20, { bounciness: 1 }));
    const wall = world.add(
      createBody(510, 300, 20, { static: true, bounciness: 1 }),
    );
    ball.vel = vec(100, 0);
    world.step(1 / 60);
    expect(ball.vel.x).toBeLessThan(0); // the ball turned back
    expect(wall.pos.x).toBe(510); // the wall stayed put
    expect(wall.vel.x).toBe(0);
  });

  it("overlap is corrected in proportion to mass", () => {
    const world = new World(2000, 600, 0);
    const a = world.add(createBody(500, 300, 20));
    const b = world.add(createBody(510, 300, 20)); // 30px of overlap
    a.vel = vec(1, 0); // give them an approach so it gets resolved
    world.step(1 / 60);
    const dist = length(sub(b.pos, a.pos));
    expect(dist).toBeGreaterThanOrEqual(40 - 0.001); // separated now
  });

  it("leaves separating bodies alone (no sticking bug)", () => {
    const world = new World(2000, 600, 0);
    const a = world.add(createBody(500, 300, 20));
    const b = world.add(createBody(530, 300, 20)); // 10px of overlap, but...
    a.vel = vec(-100, 0); // ...they are already separating
    b.vel = vec(100, 0);
    world.step(1 / 60);
    expect(a.vel.x).toBeCloseTo(-100); // velocities untouched
    expect(b.vel.x).toBeCloseTo(100);
  });
});

describe("contact event: the engine's door to the outside world", () => {
  it("reports the collision severity (the approach speed)", () => {
    const world = new World(2000, 600, 0);
    const a = world.add(createBody(490, 300, 20));
    const b = world.add(createBody(530, 300, 20, { static: true }));
    a.vel = vec(300, 0);

    let reported = 0;
    world.onContact(({ speed }) => {
      reported = speed;
    });

    world.step(1 / 60);
    expect(reported).toBeGreaterThan(0);
    expect(reported).toBeCloseTo(300, -1); // approach speed ≈ 300 px/s
  });

  it("two static bodies produce no contact", () => {
    const world = new World(2000, 600, 0);
    world.add(createBody(500, 300, 20, { static: true }));
    world.add(createBody(510, 300, 20, { static: true }));
    let called = false;
    world.onContact(() => {
      called = true;
    });
    world.step(1 / 60);
    expect(called).toBe(false);
  });
});
