# ⚔️ AREK SARUNGAN SLAYER

> **Game Aksi Beat 'em Up, Warkop Defense & Tawuran Smash Bros Khas Suroboyoan**  
> *Zero Install • HTML5 Canvas 2D Engine (60 FPS) • Cross-Platform (Mobile, PC, Tablet, Smart TV) • Local Node.js + Socket.IO LAN Server & PeerJS P2P.*

[![GitHub Pages](https://img.shields.io/badge/PLAY%20ONLINE-GitHub%20Pages-24292e?style=for-the-badge&logo=github)](https://nabil-al-maruf.github.io/Sarungan-Slayer/)
[![Version](https://img.shields.io/badge/version-1.9.1%20Snappy%20Brawl%20Overhaul-orange?style=for-the-badge)](https://nabil-al-maruf.github.io/Sarungan-Slayer/)
[![Tech Stack](https://img.shields.io/badge/tech-Node.js%20%7C%20Socket.IO%20%7C%20TypeScript%20%7C%20Canvas2D-blue?style=for-the-badge)](https://github.com/Nabil-Al-Maruf/Sarungan-Slayer)

---

## 📖 Latar Belakang & Kisah (Story Lore)

Di tengah hiruk pikuk Kota Pahlawan, kedamaian Kampung Tambak dan Warkop Kopi Giras terusik! Sekelompok geng preman dan wabah Zombie Suroboyo yang dipimpin oleh **Raja Sarung Baja Suramadu** mencuri Kendi Kopi Pusaka dan Sarung Sakti Leluhur.

Sebagai **Cak Bima** bersama 5 pendekar arek Suroboyo lainnya, kamu bangkit berbekal sarung sakti, 6 elemen unik, dan jurus pamungkas untuk membasmi gerombolan lawan dari Gang Tambak, Jalan Tunjungan, hingga jembatan ikonik Suramadu!

---

## 🦸‍♂️ 6 Hero Arek Suroboyo — 6 Elemen & 6 Jurus Ultimate Unik

Setiap pendekar punya **siluet sarung, gaya tebasan, elemen khas, animasi ulti, dan dampak musuh yang 100% berbeda** (bisa dilihat live lengkap dengan animasi & matchup zombie di menu **🥋 Info Hero**):

| Hero | Archetype | Elemen Khas | Jurus Ultimate & Dampak Musuh |
|---|---|---|---|
| **🧣 Cak Bima** | *Balanced* | 🌀 **Badai Topan** *(Jangkauan lebar & knockback angin)* | **🌀 Badai Gasing Suroboyo** — Menyedot musuh ke pusat pusaran lalu meledakkan mentalan besar |
| **🗡️ Mat Clurit** | *Assassin* | ⚡ **Petir Halilintar** *(Kilat listrik & stun lumpuh)* | **⚡ Tebasan Petir Halilintar** — Stun listrik 1.8 detik + Eksekusi +40% DMG ke musuh sekarat |
| **🥊 Bang Bambang** | *Juggernaut* | ❄️ **Es Gletser** *(Kristal es & beku stun)* | **❄️ Hantam Gletser Es** — Pilar es beku 1.8 detik + Pemecah Perisai (+50% DMG ke Boss/Tank) |
| **🎋 Gus Dimas** | *Zoner (3× Jump)* | ✨ **Cahaya Suci** *(Karomah lifesteal & cas ulti)* | **🐉 Naga Barong & Bambu Suci** — Naga menembus barisan musuh + heal 25% HP tim |
| **🧨 Pak RT Karbit** | *Trapper* | 🔥 **Api Kobaran** *(Lidah api & bonus bakar)* | **💥 Meriam Bazooka Karbit** — 3 roket artileri + kawah api membara 3.5 detik di tanah |
| **💃 Mbak Sri** | *Acrobat* | 🍃 **Daun Rimba** *(Daun silet & angkat ke udara)* | **🍃 Badai Daun Sutra** — Pusaran daun tajam 360° menjuggle musuh di udara + lemparan spiral |

---

## ⚡ Resonansi Jurus Gabungan Mabar (Cut-In ala *Wuthering Waves*)

Khusus mode **Mabar Co-op Survival**, ketika **2, 3, 4, 5, atau 6 pemain menekan tombol Ultimate secara bersamaan** (jendela sinkronisasi `0.65 detik`), akan muncul **Scene Cut-In Diagonal Sinematik** diikuti animasi jurus gabungan berskala besar:
- **⚡ 2× Duo Resonance:** **15 kombinasi pasangan Hero unik** (mis. *Topan Halilintar Suramadu*, *Thermal Shock Meriam Es*, *Taman Surga Sutra*, dll.) dengan animasi *Dual Crossing Beams*.
- **🔥 3× Trio Trinity:** *Trinitas Resonansi Suroboyo* — animasi *Prisma Segitiga 3 Pilar*.
- **💥 4× Quartet Cataclysm:** *Kuartet Bencana Elemen* — animasi *Silang 4 Penjuru Layar*.
- **🌟 5× Penta Overdrive:** *Penta Overdrive Nusantara* — animasi *Pentagram Bintang 5 Elemen*.
- **👑 6× Hexad Ultimate:** *Kebangkitan 6 Pendekar Suroboyo* — animasi *Hexagram 6 Elemen + Retakan Kaca Dimensi + Full Heal 100% Tim!*

*(Di mode **Brawl PvP**, ulti kombinasi dinonaktifkan agar duel antar pemain tetap murni & kompetitif.)*

---

## 🎮 Mode Permainan & 4 BGM Berbeda

Setiap mode memiliki **BGM (musik latar) tersendiri**: **Menu Utama** (`menu_theme.mp3`), **Story Mode** (`battle_theme.mp3`), **Mabar / Survival** (`mabar_theme.mp3`), dan **Smash Brawl** (`brawl_theme.mp3`).

### 1. 🥊 Super Smash Bros Tawuran (Snappy Balanced PvP — Max 6 Pemain / Bot AI)
- **Ring-Out Blast Zone & 3 Stocks:** Lontarkan lawan keluar arena (kiri, kanan, atas, bawah) untuk K.O.!
- **Mekanisme Pertarungan Snappy (v1.9.1):**
  - **Coyote Time & Jump Buffer** untuk kontrol lompat super responsif di tepi platform.
  - **Up-Diagonal Recovery Dash (`Atas + Dash` di udara)** untuk penyelamatan darurat kembali ke panggung.
  - **Serangan Berarah:** `Bawah + Melee` di udara memicu **⬇️ Meteor Spike**, `Atas + Melee` memicu **Up-Launcher** untuk combo udara, dan kombo darat maju dengan micro-lunge.
  - **Jejak Asap Smash Launch & Comeback Meter** (+4% cas Ult saat menerima serangan).
- **Seimbang di Semua Hero:** Stat 6 Hero, durasi Ulti (`2.2s`), knockback, dan hitstun diseimbangkan khusus PvP.
- **3 Peta Arena:** Alun-Alun, Atap Warga (jurang tengah), dan Jembatan Kali, plus *Soft Platform Drop* (`Bawah + Lompat`) dan **Kendi Emas (Smash Ball)**.

### 2. ⚔️ Story Mode (Petualangan 3 Babak)
- **Babak 1 • Gang Tambak & Kenjeran** vs *Cak Koordinator*
- **Babak 2 • Kawasan Jalan Tunjungan** vs *Jagoan Tunjungan*
- **Babak 3 • Jembatan Suramadu (Malam)** vs *Raja Sarung Baja*

### 3. 🛡️ Survival Mode (Warkop Defense — Solo & Mabar Co-op)
- Pertahankan **Pos Ronda & Warkop Pusat** dari 9 jenis Zombie Suroboyo (dengan info kelebihan & kekurangan tiap zombie di menu Info Hero).
- **Warung Warkop (`[B]`):** Upgrade Barikade Lv.1–4, Core HP, Tameng Gaib, Menara Mercon, dan **Upgrade Elemen khas Hero pilihanmu (Lv.1–3)**.
- **Buff Atribut Tiap 2 Wave:** Pilih 1 dari 3 kartu buff secara independen untuk setiap pemain.

### 4. 🥋 Pelatihan Dojo (Sandbox)
- Bebas gonta-ganti 6 Hero, 6 Elemen (Lv.1–3), 6 Jurus Ultimate, serta isi 100% bar Ulti instan.

---

## 👥 Mode Mabar Local (Socket.IO LAN & PeerJS P2P)

1. **Mode 1 — Keroyokan Layar Dewe (Layar Masing-Masing):** Setiap HP/Laptop melihat arena penuh 60 FPS tersinkronisasi penuh (map, zombie, slash elemen, peti/Kendi Emas, hazard, hingga cut-in Resonansi Gabungan).
2. **Mode 2 — 1 Monitor (Laptop/TV) + HP Jadi Stick Controller:** 1 layar besar jadi Monitor utama, HP teman jadi Gamepad konsol 360° lengkap dengan tombol Warung, Elemen, dan Haptic Rumble.

---

## 🕹️ Panduan Kontrol

### Keyboard (PC / Laptop)
| Tombol | Fungsi |
|---|---|
| `W`, `A`, `S`, `D` / `Panah` | Bergerak 8-Arah |
| `Space` | Lompat (Double / Triple Jump) |
| `S + Space` | Turun Tembus Platform (Brawl) |
| `Shift` / `L` | Dash Ngeles Cepat |
| `J` / `Z` | Serangan Melee / Kombo Hero |
| `K` / `X` | Proyektil / Skill Jarak Jauh |
| `U` / `C` | Jurus Ultimate (100% Bar) |
| `Q` / `E` | Ganti / Upgrade Elemen (Khusus Pelatihan Dojo) |
| `B` | Buka Warung Warkop (Survival) |
| `Esc` | Menu Pause / Jeda |

### Layar Sentuh / Smartphone (Wajib Landscape)
- **360° Virtual Analog** dengan native TouchEvent anti-freeze & getaran *haptic*.
- **Action Arc Pad:** Tombol `KIBAS`, `LOMPAT`, `DASH`, `PECUT`, `ULT`, `WARUNG`, dan `ELEMEN`.

---

## 🚀 Cara Menjalankan Server Lokal (0 Kuota Internet)

```bash
# 1. Install dependencies
npm install

# 2. Build frontend
npm run build

# 3. Jalankan server lokal (Socket.IO LAN port 3000)
npm start
```

Buka `http://localhost:3000` di Laptop, dan buka alamat IP LAN (misal `http://192.168.x.x:3000`) di HP yang terhubung ke Wi-Fi/Hotspot yang sama.

---

## 📝 Riwayat Versi Terbaru

- **v1.9.1:** Overhaul mekanisme Brawl (Coyote Time, Jump Buffer, Up-Diagonal Recovery Dash, Down-Air Meteor Spike, Up-Launcher, gravitasi jatuh lebih mantap, Smash Launch smoke trail, dan Comeback Ult meter).
- **v1.9.0:** 6 Hero dengan 6 Elemen unik (*Es Gletser* & *Daun Rimba*), Resonansi Jurus Gabungan Mabar (2–6 pemain ala *Wuthering Waves*), Balanced Brawl PvP (tanpa ulti kombinasi), 4 BGM berbeda (Menu, Story, Mabar, Brawl), Ensiklopedia Info Hero + matchup Zombie, fix Android Chrome 60 FPS repaint, fix 404 audio GitHub Pages, dan fix Buff Picker Mabar.
- **v1.8.0:** Mode Super Smash Bros Tawuran (Max 6 Pemain/Bot AI), 6 Hero Suroboyo, Server Local Node.js + Socket.IO.
- **v1.7.0:** 4 Jurus Ultimate, Haptic Controller, Zero-GC 60–90 FPS Engine.
