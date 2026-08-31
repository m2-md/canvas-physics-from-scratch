# KURTARMA OPERASYONU — Sıfırdan Fizik Motoru

"Oyun Fiziği Nasıl Çalışır? Canvas'ta Sıfırdan Bir Fizik Motoru Yazmak" makalesinin
çalışan kodu. İki şey içerir:

1. **Mini 2D fizik motoru** (`src/engine/`) — bağımlılıksız, ~120 satır:
   Euler entegrasyonu, daire-daire çarpışma (impulse), duvar sekmesi, contact event'leri.
2. **Sapan oyunu** (`src/main.ts`) — siyah topu çek-bırak ile fırlat, taş halkasını kır,
   ortadaki pembe topu kurtar. Sert vuruş taşı kırar, yavaş vuruş seker.
3. **Matter.js karşılaştırması** (`src/matter-demo.ts`) — aynı sahnenin hazır motorla hali.

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm run dev
```

- `http://localhost:5173/` → sıfırdan motor ile oyun
- `http://localhost:5173/matter.html` → Matter.js versiyonu

**Nasıl oynanır:** Siyah topa tıkla, çek, bırak. Çekiş yönünün tersine fırlar
(sapan mantığı). Taşlar sadece hızlı vuruşta kırılır (eşik: 400 px/s); yavaş
vuruşta top seker. Pembe topa dokununca kazanırsın.

## Test

```bash
npm test
```

14 birim testi motorun fizik iddialarını doğrular: Euler entegrasyonu, statik
cisimlerin hareketsizliği, duvar sekmesi (bounciness oranı), impulse çözümü,
iç içe geçme düzeltmesi, "ayrılan cisimlere karışmama" kuralı ve contact
event'lerinin şiddet raporu.

## Dosya yapısı

```
src/
  engine/
    vec.ts      # Vec2 yardımcıları (add, sub, scale, dot, normalize)
    body.ts     # Body + createBody (invMass numarası)
    world.ts    # World.step: entegrasyon → duvarlar → çarpışmalar
  main.ts       # Oyun: sapan, taş halkası, kurallar (contact event'lerinde)
  matter-demo.ts# Aynı sahne Matter.js ile
tests/
  engine.test.ts
```

## Alınan dersler (makalede de anlatılır)

- Sürüklemede `pointermove`/`pointerup` **window'dan** dinlenir; canvas'tan
  dinlerseniz canvas dışında bırakılan sapan takılı kalır.
- Matter.js'te ince duvar + yüksek hız = **tunneling** (top duvarın içinden
  geçer). Çözüm: kalın duvar + fırlatma hızına üst sınır.

## Lisans

MIT
