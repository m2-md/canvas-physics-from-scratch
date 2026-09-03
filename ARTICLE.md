# Oyun Fiziği Nasıl Çalışır? Canvas'ta Sıfırdan Bir Fizik Motoru Yazmak

*Yerçekimi, çarpışma ve sapan mekaniğini kendimiz kodluyoruz — sonra da "gerçek projede ne kullanmalı?" sorusuna dürüst bir cevap veriyoruz.*

*Tahmini okuma süresi: 14 dakika*

---

Geçenlerde bir oyun tutorial'ı okudum. "Fizik kulağa zor geliyor... ama merak etmeyin, hesapları fizik motoru yapacak" diyordu. Tek satırla bir topa fizik ekliyor, top düşüyor, sekiyor, herkes mutlu.

Beni rahatsız eden de tam olarak buydu.

Çünkü o tek satırın arkasında ne olduğunu bilmiyorsanız, motor bir kara kutu (black box) olarak kalır. Top neden o hızla seker? Yerçekimini değiştirince neden her şey tuhaflaşır? İki cisim iç içe geçince ne olur? Motorun dokümantasyonunda parametre aramaya başlarsınız — ama neyi aradığınızı bilmeden.

Bunu araba kullanmaya benzetiyorum. Fizik motoru otomatik vites gibidir: konforlu, hızlı, çoğu gün ihtiyacınız olan tek şey. Ama düz vitesle öğrenen biri, debriyajın ne yaptığını *bildiği* için otomatikte de ne olup bittiğini hisseder. Bu yazıda düz vitese geçiyoruz: yerçekimini, çarpışmayı ve sekmeyi kendimiz yazacağız. Sonunda elimizde oynanabilir bir sapan (sling shot) oyunu olacak — ve yazının sonunda otomatiğe, yani Matter.js'e geri dönüp "gerçek projede hangisi?" sorusunu cevaplayacağız.

Korkulacak bir şey yok: bir oyun için gereken fiziğin tamamı lise formüllerinden ibaret. Hız, konum, biraz vektör. Hepsi bu.

### Önce Sahneyi Kuralım: Oyun Döngüsü

Her oyunun kalbinde bir döngü atar: **oyun döngüsü** (game loop). Saniyede ~60 kez şu üç adım döner:

1. Zamanı ölç (son kareden bu yana kaç saniye geçti?)
2. Dünyayı güncelle (fizik burada)
3. Ekrana çiz

Tarayıcıda bu döngüyü `requestAnimationFrame` ile kurarız. Daha önce event loop üzerine yazmıştım; `requestAnimationFrame` de aynı mekanizmanın bir parçası — tarayıcı bir sonraki kareyi çizmeden hemen önce bizim fonksiyonumuzu çağırır:

```ts
// src/main.ts — oyun döngüsü (projedeki tam hali)
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
```

Buradaki `dt` (delta time), kareler arasında geçen süredir. Neden önemli? Çünkü hızlı bir bilgisayarda saniyede 120 kare, yavaşta 30 kare çizilir. "Her karede 5 piksel ilerle" derseniz oyun hızlı makinede iki kat hızlı oynar. "Saniyede 300 piksel ilerle, karede `300 * dt` kadar git" derseniz her makinede aynı oynar. `Math.min` ile `dt`'yi sınırlamamızın sebebi de şu: kullanıcı sekmeyi değiştirip geri dönerse `dt` birden 5 saniye olabilir — ve topunuz tek karede duvarın içinden ışınlanır.

### Vektörler: Fiziğin Alfabesi

2D dünyada her şey iki sayıdır: `x` ve `y`. Konum bir vektördür, hız bir vektördür, yerçekimi bir vektördür. Motorumuzun temelinde şu küçük yardımcılar yatacak:

```ts
// src/engine/vec.ts
export type Vec2 = { x: number; y: number };

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Vec2, b: Vec2): Vec2 => vec(a.x - b.x, a.y - b.y);
export const scale = (a: Vec2, s: number): Vec2 => vec(a.x * s, a.y * s);
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

export const normalize = (a: Vec2): Vec2 => {
  const len = length(a);
  return len === 0 ? vec() : scale(a, 1 / len);
};
```

İki tanesi yıldız oyuncu:

- `normalize`, bir vektörün sadece **yönünü** verir (uzunluğu 1'e indirir). "Çarpışma hangi yönde oldu?" sorusunun cevabı budur.
- `dot` (iç çarpım), bir vektörün başka bir yöndeki **gölgesini** ölçer. "Top duvara ne kadar *dik* çarpıyor?" sorusunun cevabı da budur. Birazdan ikisini de iş başında göreceğiz.

### Cisimler: Dünyadaki Aktörler

Motorumuzda her şey bir daire. Bu bilinçli bir tercih — daire-daire çarpışması tek satırlık bir mesafe testi, dikdörtgenler ise köşe durumlarıyla dolu bir çile. Öğrenirken basit şekil, sağlam kavram.

```ts
// src/engine/body.ts
import { type Vec2, vec } from "./vec";

export interface Body {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  invMass: number; // 1/kütle — statik cisimler için 0
  bounciness: number; // 0 = hiç sekmez, 1 = tam sekme
}

export function createBody(
  x: number,
  y: number,
  radius: number,
  opts: { static?: boolean; bounciness?: number } = {},
): Body {
  return {
    pos: vec(x, y),
    vel: vec(),
    radius,
    invMass: opts.static ? 0 : 1 / (radius * radius),
    bounciness: opts.bounciness ?? 0.6,
  };
}
```

Burada tuhaf görünen bir şey var: kütle yerine `invMass`, yani kütlenin tersi (1/m). Peki neden?

Çünkü fizikte "hareket etmeyen" cisimler — duvarlar, zemin, platformlar — sonsuz kütleli kabul edilir. Kodda `Infinity` ile çarpıp bölmek dert; ama tersini alırsanız sonsuz kütle `0` oluverir. Çarpışma formüllerinde `invMass` çarpan olarak geçer: statik cisim için sonuç otomatik olarak sıfır çıkar, cisim yerinden oynamaz. Tek bir sayıyla hem "taşınabilir" hem "kaya gibi sabit" cisimleri aynı formülden geçirebilirsiniz. Küçük bir numara, büyük bir sadelik.

`1 / (radius * radius)` ise kütleyi alanla orantılı yapıyor: büyük top ağır, küçük top hafif. Gerçekçi hissettiren detaylar bazen bu kadar ucuz.

### Yerçekimi: İki Satırlık Evren

İşte yazının en güzel sürprizi. Yerçekimi — o kulağa en "fizik" gelen şey — motorumuzda topu topu iki satır:

```ts
// src/engine/world.ts — step() içindeki entegrasyon satırları
b.vel = add(b.vel, scale(this.gravity, dt)); // hız  += yerçekimi * zaman
b.pos = add(b.pos, scale(b.vel, dt));        // konum += hız * zaman
```

Hepsi bu.

Yerçekimi hızı değiştirir, hız konumu değiştirir. Her karede bu iki satır çalışır ve top *düşer*. Bu tekniğin adı **Euler entegrasyonu** (Euler integration) — Newton'un diferansiyel denklemlerini "küçük zaman dilimlerinde toplama" ile çözmenin en basit yolu. Büyük motorlar daha hassas yöntemler kullanır (Verlet, RK4), ama bir oyun için Euler fazlasıyla yeterli.

Dünyamızın iskeleti şöyle başlıyor:

```ts
// src/engine/world.ts — iskelet: remove/onContact/emitContact ve
// collideWalls/collideBodies gövdeleri aynı dosyada, aşağıdaki bölümlerde
export class World {
  bodies: Body[] = [];
  gravity: Vec2;

  constructor(
    public width: number,
    public height: number,
    gravityY = 900,
  ) {
    this.gravity = vec(0, gravityY);
  }

  add(body: Body): Body {
    this.bodies.push(body);
    return body;
  }

  step(dt: number) {
    // 1. Entegrasyon: yerçekimi → hız → konum
    for (const b of this.bodies) {
      if (b.invMass === 0) continue; // statikler düşmez
      b.vel = add(b.vel, scale(this.gravity, dt));
      b.pos = add(b.pos, scale(b.vel, dt));
    }
    // 2. Duvar çarpışmaları
    for (const b of this.bodies) this.collideWalls(b);
    // 3. Cisim-cisim çarpışmaları (her çift bir kez)
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        this.collideBodies(this.bodies[i], this.bodies[j]);
      }
    }
  }
}
```

Dikkat: `gravityY = 900`. Gerçek dünyada 9.8 m/s² ama bizim birimimiz metre değil, **piksel**. 1000 piksellik sahnede 900 px/s² "doğru" hissettiriyor. Oyun fiziğinde gerçekçilik değil, *his* kazanır — Angry Birds'ün yerçekimi de gerçekçi değildir, iyi hissettirir.

### Duvarlar: İlk Çarpışmamız

Top ekrandan düşüp gitmesin. Duvar çarpışması, çarpışma dünyasına en yumuşak giriş — çünkü duvarın normali (yüzeyine dik yön) zaten belli:

```ts
// src/engine/world.ts — World gövdesi
private collideWalls(b: Body) {
  if (b.invMass === 0) return;

  if (b.pos.x - b.radius < 0) {
    b.pos.x = b.radius;
    b.vel.x = -b.vel.x * b.bounciness;
  }
  if (b.pos.x + b.radius > this.width) {
    b.pos.x = this.width - b.radius;
    b.vel.x = -b.vel.x * b.bounciness;
  }
  if (b.pos.y - b.radius < 0) {
    b.pos.y = b.radius;
    b.vel.y = -b.vel.y * b.bounciness;
  }
  if (b.pos.y + b.radius > this.height) {
    b.pos.y = this.height - b.radius;
    b.vel.y = -b.vel.y * b.bounciness;
  }
}
```

Desen her duvarda aynı: taşma varsa cismi **içeri geri it**, sonra hızın o eksendeki bileşenini **ters çevir** ve `bounciness` ile çarp. `bounciness: 0.6` demek her sekmede hızın %60'ı kalır demek — top gitgide sönümlenir, tıpkı gerçek bir basketbol topu gibi.

Konumu geri itmeyi atlarsanız klasik bir bug ile tanışırsınız: top duvarın içinde titreyip kalır. Çünkü her karede "duvardayım, hızımı ters çevireyim" der, ama duvardan çıkamadığı için bir sonraki karede yine ters çevirir. Sonsuz kararsızlık. Çözüm hep aynı: önce geometriyi düzelt, sonra hızı.

### Peki İki Top Çarpışırsa?

Asıl olay burası. İki daire çarpışması iki sorudan oluşur: **çarpıştılar mı** ve **şimdi ne olacak**?

İlk soru tek satır: merkezler arası mesafe, yarıçapların toplamından küçükse çarpışma var. İkinci soru ise motorumuzun en "fizikli" kısmı — impulse (anlık itki) hesabı:

```ts
// src/engine/world.ts — World gövdesi
private collideBodies(a: Body, b: Body) {
  const totalInvMass = a.invMass + b.invMass;
  if (totalInvMass === 0) return; // iki statik cisim çarpışamaz

  const delta = sub(b.pos, a.pos);
  const dist = length(delta);
  const minDist = a.radius + b.radius;
  if (dist >= minDist || dist === 0) return; // temas yok

  const normal = normalize(delta); // a'dan b'ye çarpışma yönü
  const relVel = sub(b.vel, a.vel);
  const approach = dot(relVel, normal); // normal boyunca yaklaşma hızı
  if (approach > 0) return; // zaten ayrılıyorlar

  this.emitContact(a, b, -approach);

  // Impulse: çarpışmanın "şiddetini" tek sayıya indirger
  const e = Math.min(a.bounciness, b.bounciness);
  const impulse = (-(1 + e) * approach) / totalInvMass;
  a.vel = sub(a.vel, scale(normal, impulse * a.invMass));
  b.vel = add(b.vel, scale(normal, impulse * b.invMass));

  // İç içe geçmeyi düzelt: herkes kütlesi oranında geri çekilir
  const overlap = minDist - dist;
  a.pos = sub(a.pos, scale(normal, overlap * (a.invMass / totalInvMass)));
  b.pos = add(b.pos, scale(normal, overlap * (b.invMass / totalInvMass)));
}
```

Adım adım okuyalım, çünkü bu 20 satır bütün fizik motorlarının çekirdeğidir:

1. `normal` — çarpışmanın yönü. İki merkezi birleştiren doğru, normalize edilmiş hali.
2. `approach` — iç çarpımın sahne aldığı yer. Göreli hızın, çarpışma yönündeki gölgesi. Negatifse cisimler birbirine *yaklaşıyor*; pozitifse zaten ayrılıyorlar ve karışmamak gerek. (Karışırsanız cisimler birbirine yapışır — denedim, komik ama yanlış.)
3. `impulse` — çarpışmanın şiddeti. `(1 + e)` sekme enerjisini ekler, `totalInvMass`'e bölmek şiddeti kütlelere paylaştırır. Sonra her cisim kendi `invMass`'i oranında bu itkiyi yer: ağır cisim az sarsılır, hafif cisim savrulur, statik cisim (invMass = 0) hiç kımıldamaz. Duvar bölümündeki numara burada meyvesini verdi — tek formül, üç davranış.
4. Son iki satır yine aynı altın kural: **önce geometri, sonra hız.** İç içe geçmiş daireleri kütleleri oranında ayırıyoruz.

`emitContact` ise motorun dış dünyaya açılan kapısı: "şu iki cisim, şu şiddetle çarpıştı" diye haber verir. Oyun mantığı — blok kırma, kazanma — motorun içine değil, bu event'lere yazılır. Motor fiziği bilir, oyunu bilmez. Bu ayrım küçük projede lüks gibi görünür ama motorunuzu ikinci oyununuzda da kullanmak istediğinizde kendinize teşekkür edersiniz.

### Sapan: Parmağınızdaki Impulse

Fizik hazır. Şimdi oyunculuk katıyoruz: topu tut, geri çek, bırak. Angry Birds'ü Angry Birds yapan mekanik.

İşin sırrı basit — çekiş vektörünün *tersi* yönünde bir hız veririz. Ne kadar çok çekerseniz o kadar hızlı fırlar:

```ts
// src/main.ts
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
```

Yorum satırındaki uyarı, bu oyunu test ederken yediğim gerçek bir bug'dan geliyor: `pointerup`'ı canvas'tan dinlemiştim, oyuncu (yani ben) topu canvas'ın bir piksel dışında bırakınca sapan sonsuza kadar gergin kaldı. Tarayıcıda sürükleme yapıyorsanız kural basit: başlangıcı elemandan, devamı ve bitişi `window`'dan dinleyin.

Çizim tarafında çekiş sırasında top ile parmak arasına bir lastik çizgisi çizeriz — oyuncu ne kadar güç biriktirdiğini gözüyle görür. Görsel geri bildirim (visual feedback) olmadan sapan, sapan gibi hissettirmez.

### Oyun: KURTARMA OPERASYONU

Parçaları birleştirelim. Oyunumuzun kurgusu şu: ortada hapsolmuş pembe bir top, etrafında taştan bir halka. Siyah topu sapanla fırlatıp taşları kırıyor ve pembe topa ulaşmaya çalışıyorsunuz.

Ama bir **twist** ekliyoruz, yoksa oyun üç saniyede biter: taşlar sadece *yeterince sert* vuruşta kırılır. Yavaş dokunuşta top sekip geri gelir. Yani her atış bir karar: doğrudan mı vurayım, duvardan mı sektireyim?

Kurulum, motorumuz sayesinde birkaç satır. Tek incelik en başta: dünyayı sabit 800×600 değil, **viewport boyutunda** kuruyoruz ve bütün boyutları kısa kenara göre ölçekliyoruz. Canvas'ın iç çözünürlüğü ekranla birebir olunca CSS ölçeklemesi kalmaz — oyun her ekranı doldurur ama daireler daire kalır:

```ts
// src/main.ts
// Ekran ne olursa olsun aynı his: kısa kenarı 600px'lik referansa oranla
let W = window.innerWidth;
let H = window.innerHeight;
const SCALE = Math.min(W, H) / 600;

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
```

Yerçekimini de (`900 * SCALE`) ölçeklediğimize dikkat edin. Piksel cinsinden çalışıyoruz; küçük bir telefon ekranında 900 px/s², koca bir monitördekinden çok daha "ağır" hissettirir. Hepsini aynı orana bağlayınca oyun her cihazda aynı oynanır.

Oyun kuralları ise — söz verdiğimiz gibi — motorun içinde değil, contact event'lerinde yaşıyor:

```ts
// src/main.ts — oyun kuralları
const BREAK_SPEED = 400 * SCALE; // px/s — bundan yavaş vuruş taşı kırmaz

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
```

`speed` parametresi, çarpışma çözümünde hesapladığımız yaklaşma hızının ta kendisi. Motoru yazarken "bu değeri dışarı verelim" dediğimiz an, oyun tasarımına bir kapı açmıştık: kırılma eşiği, hasar sistemi, ses şiddeti — hepsi bu tek sayıdan türer.

Hepsi bu kadar. Motor ~145 satır, oyun ~210 satır. Ve artık o topun *neden* öyle sektiğini satır satır biliyorsunuz.

### Peki Gerçek Projede? Matter.js'e Dönüş

Şimdi dürüst konuşalım. Düz vitesi öğrendik; peki her gün düz vites mi kullanmalı?

Hayır.

Motorumuz dairelerle sınırlı. Dikdörtgen ekleyin, döndürme (rotation) ekleyin, yüzlerce cisimde performans isteyin — her biri motorumuzun boyutunu ikiye katlar. Box2D ve Matter.js gibi motorlar bu yolda on yıllarca yürümüş projeler; sürtünme, uyku modu (sleeping), constraint'ler, broad-phase optimizasyonu... Bunları yeniden yazmak öğrenmek için harika, üretim için israf.

İyi haber: motorumuzu yazdığınız için Matter.js'in API'si artık yabancı dil değil. Aynı sapan kurulumu Matter.js'te şöyle görünür:

```ts
// src/matter-demo.ts — ilgili kısım. collisionStart gövdesi burada
// TEMSİLÎ bırakıldı; dosyadaki gerçek handler taşı kırıp kazanmayı işler.
import Matter from "matter-js";

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

Matter.Events.on(engine, "collisionStart", (event) => {
  for (const pair of event.pairs) {
    // pair.collision.normal → bizim "normal"imiz
    // pair.collision.depth  → bizim "overlap"imiz
  }
});
```

Tanıdık geldi mi? `restitution` bizim `bounciness`, `isStatic` bizim `invMass = 0`, `collisionStart` bizim `onContact`. İsimler değişmiş, kavramlar aynı. Kara kutu artık cam kutu.

Duvarlardaki "KALIN" yorumunun da bir hikayesi var. İlk denememde duvarları 20 piksel yapmıştım; topu tam güçle fırlatınca duvarın *içinden geçip* sahneden kaçtı. Buna **tunneling** denir: çok hızlı bir cisim, tek karede duvarın bir yanından öbür yanına ışınlanır ve çarpışma testi arada kalan duvarı hiç görmez. Bizim motorda bu imkansızdı — duvarları geometrik sınır olarak yazmıştık, Matter.js'te ise duvar da sıradan bir cisim. Aynı kavram, iki farklı tasarım kararı; ve motorunuzu kendiniz yazınca bu farkı dokümantasyondan değil, refleksten biliyorsunuz. (Pratik çözüm: kalın duvar + fırlatma hızına üst sınır.)

Karar çizelgem şu:

- **Kendi motorun:** öğrenme projeleri, çok basit fizik (tek top, birkaç sekme), motorun tamamına hükmetmek istediğin ufak oyunlar.
- **Matter.js:** dikdörtgen/poligon gereken, döndürmeli, constraint'li her şey. Prototipten üretime en hızlı yol.
- **Box2D (WASM):** performansın kritik olduğu, yüzlerce cisimli ciddi oyunlar.

### Özetle:

1. Oyun döngüsü `requestAnimationFrame` + `dt` ile kurulur; hız her zaman "saniyede", asla "karede" tanımlanır.
2. Yerçekimi iki satırdır: hız += yerçekimi × dt, konum += hız × dt (Euler entegrasyonu).
3. `invMass` numarası: kütlenin tersini tutarsan statik cisimler formüllerden bedavaya çıkar.
4. Çarpışmanın iki adımı: mesafe testi (çarpıştılar mı?) ve impulse (şimdi ne olacak?).
5. Altın kural: önce geometriyi düzelt (iç içe geçmeyi ayır), sonra hızı değiştir.
6. Oyun kuralları motora değil, contact event'lerine yazılır — motor fiziği bilir, oyunu bilmez.
7. Üretimde tekerleği yeniden icat etme: kavramları öğren, sonra Matter.js kullan.

Kodun tamamı — motor, oyun, testler ve Matter.js karşılaştırması — GitHub'da; README'deki komutlarla dakikada ayağa kalkıyor.

Bu yazıyı yazarken fark ettiğim şey şu oldu: "fizik motoru" teriminin yarattığı korkunun kendisi, motorların en iyi pazarlaması. Perdeyi araladığınızda karşınıza çıkan, lise fiziği ve yirmi satırlık bir impulse hesabı. Belki de öğrenmeyi ertelediğimiz çoğu "zor" konu böyledir — kutusu içinden büyük.

Sapanı çekin, taşları kırın. Pembe top sizi bekliyor. ⚙️🧠

---

### 🚀 Serinin ve Konunun Devamı
Web oyun motoru ve tarayıcı render mimarisi serisindeki sonraki bölümler:
- 📌 **[Retina Ekranda Canvas Neden Puslu Görünür? devicePixelRatio ve İki Ayrı Boyutun Hikâyesi](https://medium.com/@mkare)** — *Yazdığımız oyun motorunun yüksek çözünürlüklü ekranlarda bulanıklaşmasını engelleyen HiDPI çözümü.*
- 📌 **[Metronomlu Fizik: Sabit Adımlı Oyun Döngüsü ve Render Enterpolasyonu](https://medium.com/@mkare)** — *Değişken dt sorununu çözüp 60Hz ve 144Hz ekranlarda fiziği deterministik kılan metronom döngüsü.*
- 📌 **[Herkesle Tokalaşmak: 200 Nesneden 20.000'e Broad-Phase Çarpışma ve Uzamsal Hash](https://medium.com/@mkare)** — *Sahnede cisim sayısı arttığında O(n²) dar boğazını uzamsal ızgarayla kırma rehberi.*

---

### 👋 Yazar Hakkında
Ben **Mustafa Morbel** — 14 yılı aşkın süredir modern web teknolojileri, oyun motorları, WebGL/Canvas grafikleri ve yapay zekâ iş akışları üzerine geliştirme yapıyorum.

* Bu yazıda sıfırdan yazdığımız fizik motorunu, oynanabilir sapan oyununu ve testleri **[GitHub (@mkare)](https://github.com/mkare)** profilimde bulabilirsiniz.
* Yeni teknik rehberler ve mimari derinlemesine incelemeler için **[LinkedIn](https://linkedin.com/in/mustafamorbel)** ve **[X / Twitter (@mustafamorbel)](https://x.com/mustafamorbel)** üzerinden takibe alabilirsiniz.
* Kendi oyun projelerinizde fiziği nasıl çözdüğünüzü yorumlarda paylaşmayı, faydalı bulduysanız 👏 alkış bırakmayı unutmayın!
