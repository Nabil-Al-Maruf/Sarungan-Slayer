# GAME DESIGN DOCUMENT (GDD): AREK SARUNGAN SLAYER

## 1. Ringkasan Proyek (Project Overview)
* **Judul Game:** Arek Sarungan Slayer
* **Genre:** 2D Top-Down Action RPG / Survival Arcade (Kamera atas 3/4 ala *Stardew Valley* / *Harvest Moon* / 2D MMORPG, aksi ala *Metal Slug* & *COD Zombies* lokal)
* **Tema & Latar:** Kultur lokal Surabaya (Boso Suroboyoan, ikon kota Surabaya, humor tongkrongan)
* **Gaya Visual:** Clean 2D Vector/Cartoon (HTML5 Canvas 2D dengan garis tepi tegas, efek *squash-and-stretch*, partikel dinamis, tanpa aset gambar eksternal/berat)
* **Audio:** Procedural Sound Effects & BGM via Web Audio API (tanpa file MP3 eksternal)
* **Platform & Orientasi:** Web Browser (Desktop & Mobile), mendukung rotasi dinamis **Portrait** (tampilan ala konsol genggam: layar game di atas, kontrol virtual di bawah) dan **Landscape** (layar penuh dengan HUD & tombol transparan).
* **Arsitektur Jaringan:** 100% Tanpa Database (*Serverless/Stateless*). Menggunakan **WebRTC (PeerJS)** topologi *Host-Client* untuk mode mabar 2–5 pemain, serta `localStorage` untuk progres lokal.

---

## 2. Karakter & Sistem Pertarungan (Combat Mechanics)
Semua karakter menggunakan 1 *rig* animasi dasar **Arek Suroboyo** (berpeci/ikat kepala, kaos santai, dan sarung yang diselempangkan/dipegang sebagai senjata), namun dibedakan berdasarkan **palet warna baju & sarung** untuk membedakan Player 1 sampai Player 5.

### A. Kontrol & Aksi Utama
1. **Gerak & Lompat:** Bergerak kiri/kanan, lompat (*double jump* ringan), dan *dash* singkat untuk menghindar.
2. **Serangan Utama — Kibas Sarung (Melee):**
   * Serangan jarak dekat dengan area tebasan melengkung (*arc hitbox*).
   * Memberikan efek *knockback* (memukul mundur musuh) dan **mengisi bar Ultimate** setiap kali mengenai target.
3. **Serangan Sekunder — Proyektil Khusus:**
   * Melontarkan serangan jarak jauh khas sarung (misal: *Sabetan Angin Pecut* yang menembus 2–3 musuh lurus ke depan).
   * Memiliki sistem **Cooldown** singkat (2,5 detik) — tanpa batas amunisi.
4. **Skill Ultimate — Badai Sarung Suroboyo:**
   * Aktif saat bar Ultimate penuh (100%).
   * Karakter berputar cepat menciptakan pusaran angin sarung raksasa di sekitar area, memberikan *damage* besar terus-menerus selama 3 detik dan membuat karakter kebal sementara (*invulnerable*).

### B. Sistem Item & Crate (Tanpa Power-Up Senjata)
* Tidak ada perubahan jenis senjata dari *power-up*.
* Di arena akan muncul **Peti Kayu / Kardus Logistik** yang jika dihancurkan akan menjatuhkan salah satu dari 2 item:
  1. **Es Teh / Rawon (Heal):** Memulihkan sebagian HP pemain.
  2. **Kopi Giras (Ultimate Charge):** Langsung mengisi +50% bar Ultimate.

---

## 3. Mode Permainan (Game Modes)

### Mode 1: Story Mode (Single Player — 3 Stage Surabaya)
Pemain berpetualang dari kiri ke kanan (*side-scrolling*) mengalahkan gerombolan perusuh dan Boss di tiap akhir stage:
* **Stage 1: Gang Kampung Tambak & Kenjeran**
  * *Latar:* Gang padat rumah warga, jemuran, lampu jalan, dan siluet pantai.
  * *Musuh:* Bocil Sarung Dasar, Pelempar Sandal.
  * *Boss:* **Cak Koordinator Kampung Sebelah** (serangan lompatan & pecutan sarung jarak jauh).
* **Stage 2: Kawasan Jalan Tunjungan**
  * *Latar:* Gedung-gedung heritage Tunjungan di sore hari, gerobak tahu tek, dan rambu jalan.
  * *Musuh:* Geng Sarung Pelari Cepat, Penyerang Berperisai Kardus.
  * *Boss:* **Jagoan Sarung Tunjungan** (serangan *dash* beruntun dan hujan mercon banting).
* **Stage 3: Jembatan Suramadu (Malam Hari)**
  * *Latar:* Bentang kabel Jembatan Suramadu dengan efek angin laut dan lampu kota di kejauhan.
  * *Musuh:* Semua varian musuh + pasukan elite cepat.
  * *Boss:* **Raja Sarung Baja Suramadu** (memiliki 2 fase serangan dan memanggil bala bantuan).

### Mode 2: Mabar Survival (2–5 Pemain Online P2P)
Mode bertahan hidup kooperatif di satu arena simetris (kiri-tengah-kanan) melawan gelombang (*wave*) zombie lokal yang tiada habisnya.

#### 1. Inti Pertahanan (Core Objective)
* Di tengah arena terdapat **Objek Inti** (misal: *Pos Ronda / Gerobak Warkop Pusat*) yang memiliki bar HP.
* Jika HP Inti habis dihancurkan zombie, permainan berakhir (**Game Over**).

#### 2. Sistem 3 Barricade
* Terdapat **3 titik Barricade** strategis (Kiri Luar, Kiri Dalam/Atas, dan Kanan) yang berfungsi menahan laju zombie sebelum mencapai Inti.
* Barricade memiliki level kekuatan dan HP yang terlihat secara visual (dari tumpukan kardus -> pagar bambu -> gerobak besi).

#### 3. Ekonomi "Uang Receh" & Warung/Toko
* Setiap zombie yang dibunuh menjatuhkan **Uang Kecil (Receh)** yang otomatis masuk ke saldo masing-masing pemain.
* Pemain bisa membuka menu **Toko / Warung** (baik saat jeda antar-*wave* selama 10 detik maupun saat berdiri di dekat Inti) untuk membeli:
  * **Bangun / Perbaiki Barricade** (mengisi ulang HP atau *upgrade* salah satu dari 3 barricade).
  * **Tiket Revive (Hidupkan Teman):** Digunakan untuk membangkitkan rekan tim yang *knocked down* (tumbang) di arena.
  * **Es Teh Jumbo (Full Heal):** Memulihkan penuh HP pribadi atau HP Inti.
  * **Kopi Hitam Pekat:** Langsung mengisi penuh bar Ultimate.

#### 4. Rotasi Lokasi Setiap 10 Wave & Variasi Zombie
* Tingkat kesulitan, jumlah zombie, dan kecepatan *spawn* meningkat setiap *wave*.
* **Setiap kelipatan 10 Wave (Wave 10, 20, 30, dst.), area pertahanan berpindah lokasi** ke ikon Surabaya berikutnya (misal: *Wave 1–10: Kampung Tambak* -> *Wave 11–20: Alun-Alun / Bambu Runcing* -> *Wave 21–30: Pelabuhan Tanjung Perak / Suramadu*), diikuti munculnya varian zombie baru:
  * **Wave 1+:** *Zombie Warga* (lambat, standar) & *Zombie Bocil* (kecil, lari cepat).
  * **Wave 5+:** *Zombie Pocong* (bergerak melompat, bisa meloncati barricade level rendah).
  * **Wave 11+ (Pindah Map 2):** *Zombie Gendruwo / Satpol* (ukuran besar, HP tebal, penghancur barricade).
  * **Wave 21+ (Pindah Map 3):** *Zombie Tuyul Pencuri* (mengincar uang/Inti secara langsung dengan kecepatan tinggi).

---

## 4. Arsitektur Teknis & UI Responsif

### A. Multiplayer Tanpa Database (WebRTC / PeerJS)
* **Room System:** Host membuat room dan mendapatkan **Kode Room 4 Karakter** atau **Link Undangan**. Maksimal 5 pemain (1 Host + 4 Client).
* **Sinkronisasi State:**
  * *Host* bertindak sebagai otoritas simulasi (menghitung posisi zombie, HP 3 barricade, HP Inti, progres *wave*, dan perpindahan map tiap 10 *wave*).
  * *Client* mengirimkan paket input tombol & aksi pembelian toko ke Host, lalu menerima pembaruan koordinat (*state snapshot*) 20–30 kali per detik.

### B. Tata Letak Portrait & Landscape (Adaptive Viewport)
* **Resolusi Virtual:** Menggunakan aspek rasio dasar `16:9` (misal `960x540` unit logika) agar jarak serangan dan *hitbox* selalu adil di semua perangkat.
* **Mode Landscape:** Kanvas melebar memenuhi layar penuh (`100vw x 100vh`). HUD (HP, Saldo Receh, Wave, Bar Ultimate) di bagian atas; tombol virtual transparan di pojok kiri & kanan bawah (khusus perangkat sentuh).
* **Mode Portrait:** Kanvas game ditempatkan di bagian atas layar secara proporsional tanpa terpotong. Area kosong di bagian bawah berubah menjadi **Panel Kontrol Solid** (D-Pad di kiri; tombol Lompat, Kibas, Proyektil, Ultimate, dan tombol cepat Buka Toko di kanan).

---

## 5. Urutan Pengembangan yang Direkomendasikan (Milestones)
1. **Fase 1 (Core Engine & Combat):** Setup kanvas 2D responsif Portrait/Landscape, fisika gerak karakter, animasi kibas sarung, proyektil, ultimate, dan *crate* item.
2. **Fase 2 (Single Player Story Mode):** Implementasi 3 Stage Surabaya beserta musuh dasar dan 3 Boss.
3. **Fase 3 (Survival & Sistem Toko):** Implementasi Arena Inti, 3 Barricade, drop uang receh, UI Toko (termasuk item Revive), variasi zombie, dan transisi map setiap 10 *wave*.
4. **Fase 4 (Integrasi PeerJS 5-Player):** Implementasi lobi tanpa database (Create/Join Room) untuk mode Mabar Survival.
