// Aynı sahnenin Matter.js versiyonu — "otomatik vites".
// restitution = bizim bounciness, isStatic = bizim invMass = 0,
// collisionStart = bizim onContact.
import Matter from "matter-js";

// Ekran ne olursa olsun aynı his: kısa kenarı 600px'lik referansa oranla
let W = window.innerWidth;
let H = window.innerHeight;
const SCALE = Math.min(W, H) / 600;

const BREAK_SPEED = 8 * SCALE; // Matter iç birimlerinde hız eşiği
const MAX_SPEED = 30 * SCALE; // fırlatma hız sınırı (tunneling önlemi)

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
canvas.width = W;
canvas.height = H;

const engine = Matter.Engine.create();
engine.gravity.y = 1;

const ball = Matter.Bodies.circle(W * 0.2, H * 0.75, 26 * SCALE, {
  restitution: 0.7,
});
const pink = Matter.Bodies.circle(W / 2, H / 2, 22 * SCALE, { isStatic: true });
// Duvarlar KALIN (200px): hızlı cisimler ince duvarı "tünelleyip" kaçabilir.
// Uzunlukları 10000px — pencere büyüse de kenarları kaplı tutar.
const walls = [
  Matter.Bodies.rectangle(W / 2, -100, 10000, 200, { isStatic: true }),
  Matter.Bodies.rectangle(W / 2, H + 100, 10000, 200, { isStatic: true }),
  Matter.Bodies.rectangle(-100, H / 2, 200, 10000, { isStatic: true }),
  Matter.Bodies.rectangle(W + 100, H / 2, 200, 10000, { isStatic: true }),
];
Matter.Composite.add(engine.world, [ball, pink, ...walls]);

// Taş halkası
const stones = new Set<Matter.Body>();
const STONES = 10;
for (let i = 0; i < STONES; i++) {
  const angle = (i / STONES) * Math.PI * 2;
  const stone = Matter.Bodies.circle(
    W / 2 + Math.cos(angle) * 90 * SCALE,
    H / 2 + Math.sin(angle) * 90 * SCALE,
    20 * SCALE,
    { isStatic: true, restitution: 0.5 },
  );
  stones.add(stone);
  Matter.Composite.add(engine.world, stone);
}

// Pencere boyutu değişirse canvas'ı, duvarları ve halkayı eşitle
window.addEventListener("resize", () => {
  const oldCx = W / 2;
  const oldCy = H / 2;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  Matter.Body.setPosition(walls[0], { x: W / 2, y: -100 });
  Matter.Body.setPosition(walls[1], { x: W / 2, y: H + 100 });
  Matter.Body.setPosition(walls[2], { x: -100, y: H / 2 });
  Matter.Body.setPosition(walls[3], { x: W + 100, y: H / 2 });
  for (const s of stones) {
    const angle = Math.atan2(s.position.y - oldCy, s.position.x - oldCx);
    Matter.Body.setPosition(s, {
      x: W / 2 + Math.cos(angle) * 90 * SCALE,
      y: H / 2 + Math.sin(angle) * 90 * SCALE,
    });
  }
  Matter.Body.setPosition(pink, { x: W / 2, y: H / 2 });
});

let won = false;

Matter.Events.on(engine, "collisionStart", (event) => {
  for (const pair of event.pairs) {
    const { bodyA, bodyB } = pair;
    const other = bodyA === ball ? bodyB : bodyB === ball ? bodyA : null;
    if (!other) continue;

    const speed = Matter.Vector.magnitude(ball.velocity);
    if (stones.has(other) && speed > BREAK_SPEED) {
      Matter.Composite.remove(engine.world, other);
      stones.delete(other);
    }
    if (other === pink) {
      Matter.Composite.remove(engine.world, pink);
      won = true;
    }
  }
});

// Sapan
let dragging = false;
let dragPoint = { x: 0, y: 0 };

function toWorld(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  };
}

canvas.addEventListener("pointerdown", (e) => {
  const p = toWorld(e);
  const d = Matter.Vector.magnitude(Matter.Vector.sub(p, ball.position));
  if (d < ball.circleRadius! * 2.5) {
    dragging = true;
    dragPoint = p;
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
  }
});
window.addEventListener("pointermove", (e) => {
  if (dragging) dragPoint = toWorld(e);
});
window.addEventListener("pointerup", () => {
  if (!dragging) return;
  dragging = false;
  const pull = Matter.Vector.sub(ball.position, dragPoint);
  let vel = Matter.Vector.mult(pull, 0.15);
  // Hız sınırı: aşırı hızlı cisimler çarpışma testini atlayabilir (tunneling)
  const speed = Matter.Vector.magnitude(vel);
  if (speed > MAX_SPEED) vel = Matter.Vector.mult(vel, MAX_SPEED / speed);
  Matter.Body.setVelocity(ball, vel);
});

// Çizim + döngü
function drawBody(b: Matter.Body, color: string) {
  ctx.beginPath();
  ctx.arc(b.position.x, b.position.y, b.circleRadius ?? 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(now - last, 33);
  last = now;
  if (!dragging) Matter.Engine.update(engine, dt);

  ctx.fillStyle = "#f5f2eb";
  ctx.fillRect(0, 0, W, H);

  if (dragging) {
    ctx.beginPath();
    ctx.moveTo(ball.position.x, ball.position.y);
    ctx.lineTo(dragPoint.x, dragPoint.y);
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  for (const s of stones) drawBody(s, "#57534e");
  if (!won) drawBody(pink, "#ec4899");
  drawBody(ball, "#1c1917");

  ctx.fillStyle = "#1c1917";
  ctx.font = "16px system-ui, sans-serif";
  ctx.textAlign = "center";
  if (won) {
    ctx.font = "bold 42px system-ui, sans-serif";
    ctx.fillStyle = "#ec4899";
    ctx.fillText("KURTARDIN! (Matter.js) 🎉", W / 2, H / 2);
  } else {
    ctx.fillText(
      "Matter.js versiyonu — aynı sahne, hazır motor",
      W / 2,
      H - 40,
    );
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
