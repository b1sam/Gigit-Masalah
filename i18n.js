/* ==========================================================
   Gigit Masalah – i18n (Localization)
   A small, real translation system: elements tagged data-i18n
   in the HTML get their text swapped automatically, and t(key)
   is available for text that's generated dynamically in JS
   (button labels that change based on game state, etc).

   NOTE ON SCOPE: this covers the structural UI — menus, HUD,
   modal headers/tabs, settings. It intentionally does NOT cover
   every piece of dynamic content in the game (fish/junk names,
   shop item descriptions, alert messages, tutorial step text,
   credits body) — translating all of that is a much bigger task
   and out of scope here.
   ========================================================== */

import { storage } from './storage.js';

export const translations = {
  id: {
    menu_continue: 'LANJUTKAN',
    menu_start: 'MULAI',
    menu_settings: 'Pengaturan',
    menu_credits: 'Kredit',
    menu_quit: 'Keluar',
    menu_subtitle: 'Game Memancing 3D Bertema Kadal',
    menu_footer: 'Dibuat dengan Three.js · Sekolah Project',

    pause_title: 'Jeda',
    pause_resume: 'Lanjutkan',
    pause_settings: 'Pengaturan',
    pause_credits: 'Kredit',
    pause_restart: 'Restart',
    pause_mainmenu: 'Menu Utama',

    settings_title: 'Pengaturan',
    settings_audio: 'Audio (Musik & Efek Suara)',
    settings_graphics: 'Kualitas Grafis',
    settings_quality_high: 'Tinggi',
    settings_quality_low: 'Rendah',
    settings_sensitivity: 'Sensitivitas Kamera',
    settings_sens_low: 'Rendah',
    settings_sens_mid: 'Sedang',
    settings_sens_high: 'Tinggi',
    settings_language: 'Bahasa',
    settings_controls_title: 'Kontrol',
    settings_controls_desc: 'PC: WASD gerak · drag mouse kamera · SPASI lempar/tarik<br>HP: Joystick kiri gerak · geser layar kamera · tombol hijau lempar/tarik',

    credits_title: 'Kredit',

    hud_shop: 'Toko',
    hud_fishdex: 'Fishdex',
    hud_progress: 'Progres',
    hud_inventory: 'Tas',
    hud_cast_idle: 'LEMPAR KAIL',
    hud_cast_release: 'LEPAS UNTUK LEMPAR',
    hud_cast_hold_reel: 'TAHAN UNTUK TARIK',

    hint_banner: '<kbd>WASD</kbd> gerak &nbsp;·&nbsp; <kbd>drag</kbd> kamera &nbsp;·&nbsp; <kbd>SPASI</kbd> lempar/tarik &nbsp;·&nbsp; dekati kapal buat naik',

    boat_board: 'Naik Kapal',
    boat_exit: 'Turun Kapal',
    boat_bonus_badge: 'Bonus Ikan Langka Aktif',
    npc_chat_prompt: 'Ngobrol dengan Nelayan Tua',

    shop_title: 'Toko',
    shop_tab_rods: '🎣 Pancingan',
    shop_tab_baits: '🪱 Umpan',

    fishdex_title: 'Fishdex',

    inventory_title: 'Tas Barang',
    inventory_empty: 'Tas kamu masih kosong. Yuk mancing dulu!',

    progress_title: 'Progres',
    progress_tab_mission: '🎯 Misi Harian',
    progress_tab_achievements: '🏅 Lencana',
    progress_tab_leaderboard: '🏆 Papan Skor',

    profile_title: 'Setup Profil',
    profile_name_label: 'Nama Pemancing',
    profile_save: 'Simpan & Mulai Main',
    profile_status_title: 'Status Karakter',

    tutorial_title: 'Cara Bermain'
  },

  en: {
    menu_continue: 'CONTINUE',
    menu_start: 'START',
    menu_settings: 'Settings',
    menu_credits: 'Credits',
    menu_quit: 'Exit',
    menu_subtitle: '3D Lizard-Themed Fishing Game',
    menu_footer: 'Made with Three.js · School Project',

    pause_title: 'Paused',
    pause_resume: 'Resume',
    pause_settings: 'Settings',
    pause_credits: 'Credits',
    pause_restart: 'Restart',
    pause_mainmenu: 'Main Menu',

    settings_title: 'Settings',
    settings_audio: 'Audio (Music & Sound Effects)',
    settings_graphics: 'Graphics Quality',
    settings_quality_high: 'High',
    settings_quality_low: 'Low',
    settings_sensitivity: 'Camera Sensitivity',
    settings_sens_low: 'Low',
    settings_sens_mid: 'Medium',
    settings_sens_high: 'High',
    settings_language: 'Language',
    settings_controls_title: 'Controls',
    settings_controls_desc: 'PC: WASD move · drag mouse for camera · SPACE cast/reel<br>Mobile: Left joystick move · swipe screen for camera · green button cast/reel',

    credits_title: 'Credits',

    hud_shop: 'Shop',
    hud_fishdex: 'Fishdex',
    hud_progress: 'Progress',
    hud_inventory: 'Bag',
    hud_cast_idle: 'CAST LINE',
    hud_cast_release: 'RELEASE TO CAST',
    hud_cast_hold_reel: 'HOLD TO REEL',

    hint_banner: '<kbd>WASD</kbd> move &nbsp;·&nbsp; <kbd>drag</kbd> camera &nbsp;·&nbsp; <kbd>SPACE</kbd> cast/reel &nbsp;·&nbsp; approach the boat to board',

    boat_board: 'Board Boat',
    boat_exit: 'Exit Boat',
    boat_bonus_badge: 'Rare Fish Bonus Active',
    npc_chat_prompt: 'Talk to the Old Fisherman',

    shop_title: 'Shop',
    shop_tab_rods: '🎣 Rods',
    shop_tab_baits: '🪱 Baits',

    fishdex_title: 'Fishdex',

    inventory_title: 'Item Bag',
    inventory_empty: 'Your bag is empty. Go fish first!',

    progress_title: 'Progress',
    progress_tab_mission: '🎯 Daily Mission',
    progress_tab_achievements: '🏅 Badges',
    progress_tab_leaderboard: '🏆 Leaderboard',

    profile_title: 'Profile Setup',
    profile_name_label: 'Angler Name',
    profile_save: 'Save & Start Playing',
    profile_status_title: 'Character Status',

    tutorial_title: 'How To Play'
  }
};

/** Single lookup for dynamically-generated JS text (button labels that
 *  change based on game state, etc). Always reflects the current
 *  saved language automatically. */
export function t(key) {
  const lang = storage.state.language || 'id';
  const dict = translations[lang] || translations.id;
  return dict[key] !== undefined ? dict[key] : (translations.id[key] || key);
}

/** Bulk-applies the given language to every element tagged
 *  data-i18n="key" in the DOM. Uses innerHTML so translations can
 *  include simple markup (e.g. <kbd> tags in the hint banner). */
export function applyLanguage(lang) {
  const dict = translations[lang] || translations.id;
  document.documentElement.lang = lang === 'en' ? 'en' : 'id';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });
}
