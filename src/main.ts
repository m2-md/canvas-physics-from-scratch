// RESCUE OPERATION — the slingshot game.
// Engine: src/engine/ (from scratch). Game rules: in this file, in the contact events.
import { createBody, type Body } from "./engine/body";
import { World } from "./engine/world";
import { type Vec2, vec, sub, scale, length } from "./engine/vec";

// Same feel on any screen: scale the short edge against a 600px reference
let W = window.innerWidth;
let H = window.innerHeight;
const SCALE = Math.min(W, H) / 600;

const LAUNCH_POWER = 6; // factor that turns pull pixels into velocity
const BREAK_SPEED = 400 * SCALE; // px/s — a slower hit will not break a stone

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
canvas.width = W;
canvas.height = H;

// --- World setup ------------------------------------------------------------
const world = new World(W, H, 900 * SCALE);

const ball = world.add(
  createBody(W * 0.2, H * 0.75, 26 * SCALE, { bounciness: 0.7 }),
);
const pink = world.add(createBody(W / 2, H / 2, 22 * SCALE, { static: true }));

// Ring of stones around the pink ball
const stones = new Set<Body>();
const STONES = 10;
for (let i = 0; i < STONES; i++) {
  const angle = (i / STONES) * Math.PI * 2;
  const stone = createBody(
    W / 2 + Math.cos(angle) * 90 * SCALE,
    H / 2 + Math.sin(angle) * 90 * SCALE,
    20 * SCALE,
    { static: true, bounciness: 0.5 },
  );
  world.add(stone);
  stones.add(stone);
}

// If the window is resized, match the canvas and the world bounds
// (internal resolution = viewport → no scaling → circles stay circles)
window.addEventListener("resize", () => {
  const oldCx = W / 2;
  const oldCy = H / 2;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  world.width = W;
  world.height = H;
  // Move the ring to the new center (keeping each stone's angle)
  for (const s of stones) {
    const angle = Math.atan2(s.pos.y - oldCy, s.pos.x - oldCx);
    s.pos = vec(
      W / 2 + Math.cos(angle) * 90 * SCALE,
      H / 2 + Math.sin(angle) * 90 * SCALE,
    );
  }
  pink.pos = vec(W / 2, H / 2);
});

// --- Game rules: not in the engine, in the contact events -------------------
let won = false;

world.onContact(({ a, b, speed }) => {
  const other = a === ball ? b : b === ball ? a : null;
  if (!other) return;

  if (stones.has(other) && speed > BREAK_SPEED) {
    world.remove(other);
    stones.delete(other);
    spawnParticles(other.pos);
  }

  if (other === pink) {
    world.remove(pink);
    won = true; // RESCUED!
  }
});

// --- Slingshot --------------------------------------------------------------
let dragging = false;
let dragPoint: Vec2 = vec();

function toWorld(e: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return vec(
    ((e.clientX - rect.left) / rect.width) * W,
    ((e.clientY - rect.top) / rect.height) * H,
  );
}

canvas.addEventListener("pointerdown", (e) => {
  const p = toWorld(e);
  if (length(sub(p, ball.pos)) < ball.radius * 2.5) {
    dragging = true;
    dragPoint = p;
    ball.vel = vec(); // physics must not move the ball while pulling
  }
});

// Careful: move and up are listened for on window — the pull keeps going even
// if the finger slides outside the canvas, and the release is never lost. (Listen
// on the canvas and a slingshot released outside stays "stuck" — I tried it, it does.)
window.addEventListener("pointermove", (e) => {
  if (dragging) dragPoint = toWorld(e);
});

window.addEventListener("pointerup", () => {
  if (!dragging) return;
  dragging = false;
  const pull = sub(ball.pos, dragPoint); // opposite of the pull = launch direction
  ball.vel = scale(pull, LAUNCH_POWER);
});

// --- Particle effect (when a stone breaks) ----------------------------------
interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
}
let particles: Particle[] = [];

function spawnParticles(at: Vec2) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (120 + Math.random() * 240) * SCALE;
    particles.push({
      pos: vec(at.x, at.y),
      vel: vec(Math.cos(angle) * speed, Math.sin(angle) * speed),
      life: 0.6,
    });
  }
}

function updateParticles(dt: number) {
  for (const p of particles) {
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

// --- Drawing ----------------------------------------------------------------
function drawCircle(b: Body, color: string) {
  ctx.beginPath();
  ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function draw() {
  ctx.fillStyle = "#f5f2eb";
  ctx.fillRect(0, 0, W, H);

  // Slingshot band: the player sees with their own eyes how much power is stored
  if (dragging) {
    ctx.beginPath();
    ctx.moveTo(ball.pos.x, ball.pos.y);
    ctx.lineTo(dragPoint.x, dragPoint.y);
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  for (const stone of stones) drawCircle(stone, "#57534e");
  if (!won) drawCircle(pink, "#ec4899");
  drawCircle(ball, "#1c1917");

  for (const p of particles) {
    ctx.globalAlpha = Math.max(p.life / 0.6, 0);
    drawCircle({ pos: p.pos, radius: 4 * SCALE } as Body, "#78716c");
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#1c1917";
  ctx.font = "16px system-ui, sans-serif";
  ctx.textAlign = "center";
  if (won) {
    ctx.font = "bold 42px system-ui, sans-serif";
    ctx.fillStyle = "#ec4899";
    ctx.fillText("RESCUED! 🎉", W / 2, H / 2);
  } else {
    ctx.fillText(
      "Drag and release to fling the black ball • A hard hit breaks a stone, a slow one bounces",
      W / 2,
      H - 40,
    );
  }
}

// --- Game loop ---------------------------------------------------------------
let last = performance.now();

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 1 / 30); // in seconds
  last = now;

  if (!dragging) world.step(dt); // 1. advance the physics
  updateParticles(dt);
  draw(); // 2. draw to the screen

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
