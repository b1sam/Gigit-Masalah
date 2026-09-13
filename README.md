# 🎣 Gigit Masalah

Game memancing 3D berbasis browser, terinspirasi dari **Fisch (Roblox)**. Dibuat menggunakan **Three.js** — jalan langsung di browser tanpa install apa pun, bisa dimainkan di PC maupun HP.

**🔗 Main di sini:** 


## 🏆 Challenge Spesial

Coba tangkap salah satu ikan **Mythic** paling langka di game ini:

- 🐲 **Leviathan Sungai Glitch** — naga air raksasa bersisik kristal ungu-neon
- 🌌 **Naga Kosmik Bintang** — naga kosmik yang berpendar seperti galaksi

Kalau dapat salah satunya, tunjukkan layar hasil tangkapannya buat klaim hadiah **Rp 2.500**! 🎉

Screenshot chat ig@abrisam.listiyo

---


## 🎮 Cara Bermain

| Kontrol | Aksi |
|---|---|
| **WASD** / Joystick kiri bawah | Gerak karakter |
| **Drag layar/mouse** | Putar kamera |
| **SPASI** / tombol hijau | Lempar kail, hook ikan, tarik saat reeling |
| Tombol **SHAKE** | Ketuk berkali-kali saat umpan sudah di air |

**Alur bermain:**
1. Tekan **LEMPAR KAIL** → tahan sampai bar hijau di zona PERFECT → lepas
2. Kail jatuh ke air → tekan tombol **SHAKE** berkali-kali
3. Tunggu sampai muncul **GIGITAN!** → tekan cepat buat hook
4. Minigame **reeling**: tahan tombol untuk menjaga bar kuning tetap di zona hijau sampai progress penuh
5. Ikan/barang masuk ke **Tas**, bisa dijual di sana atau langsung dari modal hasil tangkapan

## ✨ Fitur

- Dunia 3D low-poly stylized (pulau tropis, langit gradient, laut animasi)
- Sistem casting dengan power meter & zona PERFECT
- Minigame shake + reeling dengan tingkat kesulitan berbeda per rarity ikan
- 15 spesies ikan (Common → Mythic) + 7 jenis barang sampah dengan nama lucu
- Sistem Toko: beli & pasang pancingan dan umpan
- Fishdex (koleksi ikan) & Tas/Inventory barang
- Preview 3D hasil tangkapan yang berputar, termasuk model custom untuk beberapa ikan langka
- XP, level, koin, dan progres otomatis tersimpan di perangkat (localStorage)
- Kontrol lengkap untuk PC (keyboard + mouse) dan mobile (joystick virtual + tap)



## 🛠️ Dibuat Dengan

- **Three.js** (r0.160) — rendering 3D & WebGL
- **HTML / CSS / JavaScript (ES Modules)** — tanpa framework, tanpa build tool
- **Web Audio API** — semua efek suara dibuat secara prosedural, tanpa file audio eksternal
- **localStorage** — sistem simpan progres otomatis
- Dipublikasikan lewat **GitHub Pages**

## 🙏 Kredit Model 3D

Sebagian besar model 3D (karakter, pancingan, dunia, sebagian besar ikan) dibuat sepenuhnya lewat kode (procedural low-poly). Beberapa model ikan langka memakai aset dari Sketchfab dengan lisensi CC-BY-4.0:

- **Kepiting** — "Chitin on Crab" oleh dini.hadiarti — https://sketchfab.com/3d-models/chitin-on-crab-ff42c79384c04271aa97b72f384b304a
- **Naga Kosmik Bintang** — "Fire dragon minecraft" oleh DPancito — https://sketchfab.com/3d-models/fire-dragon-minecraft-51f9ba01a5ba4a689a51110612db8d5d
- **Leviathan Sungai Glitch** — "LP Dragon" oleh Liormax — https://sketchfab.com/3d-models/lp-dragon-a97a1fa87bab4ba7b1169fb13f650942

## 📂 Struktur Proyek

```
index.html        → struktur halaman & semua modal UI
style.css          → seluruh tampilan/HUD
main.js            → entry point, game loop
environment.js     → dunia 3D (pulau, laut, langit, dermaga)
playerController.js→ gerak karakter, kamera, kontrol input
gameEngine.js       → logika inti: casting, shake, bite, reeling, loot table
ui.js              → interaksi HUD, modal, preview 3D
voxelModels.js      → semua model 3D low-poly (karakter, ikan, sampah, kail)
modelLoader.js      → loader opsional untuk model .glb custom
storage.js         → sistem simpan progres (localStorage)
audio.js           → semua efek suara (Web Audio API, tanpa file)
models/             → file 3D custom (.gltf/.glb) untuk ikan langka
```
