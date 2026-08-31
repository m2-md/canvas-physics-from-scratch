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

describe("vec: fiziğin alfabesi", () => {
  it("temel işlemler doğru çalışır", () => {
    expect(add(vec(1, 2), vec(3, 4))).toEqual(vec(4, 6));
    expect(sub(vec(3, 4), vec(1, 2))).toEqual(vec(2, 2));
    expect(scale(vec(2, 3), 2)).toEqual(vec(4, 6));
    expect(length(vec(3, 4))).toBe(5);
    expect(dot(vec(1, 0), vec(0, 1))).toBe(0); // dik vektörlerin iç çarpımı 0
  });

  it("normalize yönü korur, uzunluğu 1'e indirir", () => {
    const n = normalize(vec(10, 0));
    expect(n).toEqual(vec(1, 0));
    expect(length(normalize(vec(3, 4)))).toBeCloseTo(1);
    expect(normalize(vec(0, 0))).toEqual(vec(0, 0)); // sıfır vektör güvenli
  });
});

describe("body: invMass numarası", () => {
  it("statik cisimlerin invMass'i 0'dır", () => {
    expect(createBody(0, 0, 10, { static: true }).invMass).toBe(0);
  });

  it("büyük top ağırdır (invMass küçüktür)", () => {
    const small = createBody(0, 0, 10);
    const big = createBody(0, 0, 40);
    expect(big.invMass).toBeLessThan(small.invMass);
  });
});

describe("yerçekimi: iki satırlık evren (Euler entegrasyonu)", () => {
  it("cisim düşer: hız ve konum artar", () => {
    const world = new World(800, 600, 900);
    const b = world.add(createBody(400, 100, 10));
    world.step(1 / 60);
    expect(b.vel.y).toBeCloseTo(900 / 60);
    expect(b.pos.y).toBeGreaterThan(100);
  });

  it("statik cisim düşmez", () => {
    const world = new World(800, 600, 900);
    const s = world.add(createBody(400, 100, 10, { static: true }));
    world.step(1);
    expect(s.pos.y).toBe(100);
    expect(s.vel.y).toBe(0);
  });
});

describe("duvarlar: önce geometri, sonra hız", () => {
  it("sağ duvardan bounciness oranında seker", () => {
    const world = new World(800, 600, 0); // yerçekimsiz, izole test
    const b = world.add(createBody(795, 300, 10, { bounciness: 0.6 }));
    b.vel = vec(100, 0);
    world.step(1 / 60);
    expect(b.pos.x).toBe(800 - 10); // içeri geri itildi
    expect(b.vel.x).toBeCloseTo(-100 * 0.6); // ters yön + sönümleme
  });

  it("zeminde titreyip kalmaz: konum düzeltilir", () => {
    const world = new World(800, 600, 900);
    const b = world.add(createBody(400, 595, 10, { bounciness: 0 }));
    for (let i = 0; i < 120; i++) world.step(1 / 60);
    expect(b.pos.y).toBeCloseTo(600 - 10, 0); // zeminin üstünde durur
  });
});

describe("çarpışma: impulse hesabı", () => {
  it("kafa kafaya çarpışan eşit toplar yön değiştirir", () => {
    const world = new World(2000, 600, 0);
    const a = world.add(createBody(490, 300, 20, { bounciness: 1 }));
    const b = world.add(createBody(530, 300, 20, { bounciness: 1 }));
    a.vel = vec(100, 0);
    b.vel = vec(-100, 0);
    world.step(1 / 60);
    expect(a.vel.x).toBeLessThan(0); // artık sola gidiyor
    expect(b.vel.x).toBeGreaterThan(0); // artık sağa gidiyor
  });

  it("statik cisme çarpan top seker, statik kımıldamaz", () => {
    const world = new World(2000, 600, 0);
    const ball = world.add(createBody(470, 300, 20, { bounciness: 1 }));
    const wall = world.add(
      createBody(510, 300, 20, { static: true, bounciness: 1 }),
    );
    ball.vel = vec(100, 0);
    world.step(1 / 60);
    expect(ball.vel.x).toBeLessThan(0); // top geri döndü
    expect(wall.pos.x).toBe(510); // duvar yerinde
    expect(wall.vel.x).toBe(0);
  });

  it("iç içe geçme kütle oranında düzeltilir", () => {
    const world = new World(2000, 600, 0);
    const a = world.add(createBody(500, 300, 20));
    const b = world.add(createBody(510, 300, 20)); // 30px iç içe
    a.vel = vec(1, 0); // yaklaşma olsun ki çözümlensin
    world.step(1 / 60);
    const dist = length(sub(b.pos, a.pos));
    expect(dist).toBeGreaterThanOrEqual(40 - 0.001); // artık ayrılar
  });

  it("ayrılan cisimlere karışmaz (yapışma bug'ı yok)", () => {
    const world = new World(2000, 600, 0);
    const a = world.add(createBody(500, 300, 20));
    const b = world.add(createBody(530, 300, 20)); // 10px iç içe ama...
    a.vel = vec(-100, 0); // ...zaten ayrılıyorlar
    b.vel = vec(100, 0);
    world.step(1 / 60);
    expect(a.vel.x).toBeCloseTo(-100); // hızlara dokunulmadı
    expect(b.vel.x).toBeCloseTo(100);
  });
});

describe("contact event: motorun dış dünyaya kapısı", () => {
  it("çarpışma şiddetini (yaklaşma hızı) raporlar", () => {
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
    expect(reported).toBeCloseTo(300, -1); // yaklaşma hızı ≈ 300 px/s
  });

  it("iki statik cisim çarpışma üretmez", () => {
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
