// KURTARMA OPERASYONU — sapan oyunu.
// Motor: src/engine/ (sıfırdan). Oyun kuralları: bu dosyada, contact event'lerinde.
import { createBody, type Body } from "./engine/body";
import { World } from "./engine/world";
import { type Vec2, vec, sub, scale, length } from "./engine/vec";

// Ekran ne olursa olsun aynı his: kısa kenarı 600px'lik referansa oranla
let W = window.innerWidth;
let H = window.innerHeight;
const SCALE = Math.min(W, H) / 600;

const LAUNCH_POWER = 6; // çekiş pikselini hıza çeviren katsayı
const BREAK_SPEED = 400 * SCALE; // px/s — bundan yavaş vuruş taşı kırmaz

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
canvas.width = W;
canvas.height = H;

// --- Dünya kurulumu ---------------------------------------------------------
const world = new World(W, H, 900 * SCALE);

const ball = world.add(
  createBody(W * 0.2, H * 0.75, 26 * SCALE, { bounciness: 0.7 }),
);
const pink = world.add(createBody(W / 2, H / 2, 22 * SCALE, { static: true }));

// Pembe topun etrafına taş halkası
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

// Pencere boyutu değişirse canvas ve dünya sınırlarını eşitle
// (iç çözünürlük = viewport → ölçekleme yok → daireler daire kalır)
window.addEventListener("resize", () => {
  const oldCx = W / 2;
  const oldCy = H / 2;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  world.width = W;
  world.height = H;
  // Halkayı yeni merkeze taşı (her taşın açısını koruyarak)
  for (const s of stones) {
    const angle = Math.atan2(s.pos.y - oldCy, s.pos.x - oldCx);
    s.pos = vec(
      W / 2 + Math.cos(angle) * 90 * SCALE,
      H / 2 + Math.sin(angle) * 90 * SCALE,
    );
  }
  pink.pos = vec(W / 2, H / 2);
});

// --- Oyun kuralları: motorda değil, contact event'lerinde -------------------
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
    won = true; // KURTARDIN!
  }
});

// --- Sapan (sling shot) -----------------------------------------------------
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
    ball.vel = vec(); // çekerken fizik topu etkilemesin
  }
});

// Dikkat: move ve up olayları window'dan dinlenir — parmak canvas dışına
// kayarsa da çekiş devam eder, bırakış kaçmaz. (Canvas'tan dinlerseniz
// dışarıda bırakılan sapan "takılı" kalır — denedim, kalıyor.)
window.addEventListener("pointermove", (e) => {
  if (dragging) dragPoint = toWorld(e);
});

window.addEventListener("pointerup", () => {
  if (!dragging) return;
  dragging = false;
  const pull = sub(ball.pos, dragPoint); // çekişin tersi = fırlatma yönü
  ball.vel = scale(pull, LAUNCH_POWER);
});

// --- Parçacık efekti (taş kırılınca) ----------------------------------------
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

// --- Çizim ------------------------------------------------------------------
function drawCircle(b: Body, color: string) {
  ctx.beginPath();
  ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function draw() {
  ctx.fillStyle = "#f5f2eb";
  ctx.fillRect(0, 0, W, H);

  // Sapan lastiği: oyuncu ne kadar güç biriktirdiğini gözüyle görür
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
    ctx.fillText("KURTARDIN! 🎉", W / 2, H / 2);
  } else {
    ctx.fillText(
      "Siyah topu çek-bırak ile fırlat • Sert vuruş taşı kırar, yavaş vuruş seker",
      W / 2,
      H - 40,
    );
  }
}

// --- Oyun döngüsü ------------------------------------------------------------
let last = performance.now();

function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 1 / 30); // saniye cinsinden
  last = now;

  if (!dragging) world.step(dt); // 1. fiziği ilerlet
  updateParticles(dt);
  draw(); // 2. ekrana çiz

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
