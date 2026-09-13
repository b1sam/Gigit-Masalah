/* ==========================================================
   Gigit Masalah – Entry Point
   ========================================================== */

import { GameEnvironment }  from './environment.js';
import { PlayerController } from './playerController.js';
import { GameEngine }       from './gameEngine.js';
import { UIManager }        from './ui.js';
import { audio }            from './audio.js';
import { storage }          from './storage.js';
import { applyLanguage, t } from './i18n.js';

let env, playerController, engine, ui;
let lastTime = 0;
let gamePaused = true; // starts true — Main Menu is shown first

const CAMERA_SENSITIVITY_MAP = { rendah: 0.6, sedang: 1.0, tinggi: 1.5 };

// Disable right-click context menu & native image/text drag so the game
// screen can't be trivially copied via "Save As" / drag-out, alongside
// the CSS user-select:none rules in style.css.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

function init() {
  console.log('🎮 Gigit Masalah – Starting…');

  const container = document.getElementById('canvas-container');
  if (!container) { console.error('canvas-container not found'); return; }

  // 1. 3D Environment (voxel world) — builds & renders immediately so it's
  //    visible animating behind the Main Menu ("Display pra Game")
  env = new GameEnvironment(container);

  // 2. Player controller
  playerController = new PlayerController(env);

  // 3. UI manager
  ui = new UIManager(() => engine);
  playerController.ui = ui;

  // 4. Game engine
  engine = new GameEngine(env, ui);

  // 5. Apply saved rod
  env.updateRodModel(storage.state.equippedRod);

  // 6. Audio unlock on first gesture
  const unlockAudio = () => {
    audio.init();
    ['click', 'keydown', 'touchstart'].forEach(ev =>
      window.removeEventListener(ev, unlockAudio)
    );
  };
  ['click', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, unlockAudio)
  );

  // 7. Start loop
  requestAnimationFrame(animate);

  // 8. Menus (Main Menu, Pause Menu, shared Settings/Credits)
  setupMenus();
  setupIntroDialog();
  setupTutorial();
}

/* -------- NPC Intro Dialog (shown once, first time playing) --------
   "Nelayan Tua" gives a short flavor-text intro with a branching choice.
   Purely cosmetic — the choice only changes which line plays next, it
   never affects gameplay/stats. */
const NPC_DIALOG_LINES = {
  intro: 'Woi, anak muda! Selamat datang di Lizard Cove. Katanya di sungai sini ada legenda seekor kadal raksasa yang belum pernah berhasil ditangkap siapa pun... Mau dengar ceritanya?',
  yes: 'Konon namanya "Leviathan" — bersisik kristal ungu-neon, cuma nongol pas malam gelap gulita. Coba aja buktiin sendiri, Nak! Kalau mau nyari lebih jauh, ada kapal kecil di sebelah dermaga — tinggal dideketin buat naik.',
  no: 'Hahaha, dasar nggak sabaran! Yaudah, langsung aja turun ke dermaga sana, umpanmu udah nunggu tuh. Ada kapal kecil juga di sebelah dermaga kalau mau mancing lebih jauh.'
};
let introDialogOnComplete = null;

function setupIntroDialog() {
  const modal = document.getElementById('modal-npc-dialog');
  if (!modal) return;

  const textEl = document.getElementById('dialog-npc-text');
  const choicesEl = document.getElementById('dialog-npc-choices');
  const continueWrap = document.getElementById('dialog-npc-continue');
  const continueBtn = document.getElementById('btn-dialog-continue');

  const finishDialog = () => {
    storage.markIntroDialogSeen();
    modal.classList.add('hidden');
    audio.playButtonClick();
    const cb = introDialogOnComplete;
    introDialogOnComplete = null;
    if (cb) cb();
  };

  choicesEl?.querySelectorAll('.dialog-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      audio.playButtonClick();
      textEl.textContent = NPC_DIALOG_LINES[btn.dataset.choice] || NPC_DIALOG_LINES.no;
      choicesEl.classList.add('hidden');
      continueWrap.classList.remove('hidden');
    });
  });

  continueBtn?.addEventListener('click', finishDialog);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) finishDialog();
  });
}

function openIntroDialog(onComplete) {
  const modal = document.getElementById('modal-npc-dialog');
  if (!modal) { if (onComplete) onComplete(); return; }

  document.getElementById('dialog-npc-text').textContent = NPC_DIALOG_LINES.intro;
  document.getElementById('dialog-npc-choices').classList.remove('hidden');
  document.getElementById('dialog-npc-continue').classList.add('hidden');
  introDialogOnComplete = onComplete;
  modal.classList.remove('hidden');
}

/* -------- Repeatable NPC small-talk (contextual prompt #2) --------
   After the one-time intro, walking back up to the same NPC lets you
   chat again — reuses the exact same modal/DOM, just skips the choice
   branch and shows a random flavor line instead. */
const NPC_REPEAT_LINES = [
  'Sabar ya mancingnya, kadal-kadal itu nggak akan lari kemana-mana.',
  'Kalau ikannya susah nyangkut, coba ganti umpan di Toko.',
  'Katanya sih di malam hari ikan-ikan langka lebih sering muncul...',
  'Jangan lupa cek Fishdex, siapa tau udah deket lengkap semua!',
  'Kapal kecil di sebelah sana bisa dipakai buat cari ikan di laut lepas, lho.'
];

function openRepeatableNpcChat() {
  const modal = document.getElementById('modal-npc-dialog');
  if (!modal) return;

  const line = NPC_REPEAT_LINES[Math.floor(Math.random() * NPC_REPEAT_LINES.length)];
  document.getElementById('dialog-npc-text').textContent = line;
  document.getElementById('dialog-npc-choices').classList.add('hidden');
  document.getElementById('dialog-npc-continue').classList.remove('hidden');
  introDialogOnComplete = null; // just flavor chat, nothing to chain into
  modal.classList.remove('hidden');
}

const NPC_TALK_DISTANCE = 2.5;

function updateNpcChatPrompt() {
  const btn = document.getElementById('btn-npc-chat');
  if (!btn || !env?.npc || !env?.player) return;

  if (playerController?.isOnBoat) {
    btn.classList.add('hidden');
    return;
  }
  const dx = env.player.position.x - env.npc.position.x;
  const dz = env.player.position.z - env.npc.position.z;
  const near = Math.hypot(dx, dz) < NPC_TALK_DISTANCE;
  btn.classList.toggle('hidden', !near);
}

/* -------- Tutorial / Onboarding (shown once, first time playing) -------- */
let tutorialStep = 1;
let tutorialTotalSteps = 4;
let tutorialOnComplete = null;

function setupTutorial() {
  const modal = document.getElementById('modal-tutorial');
  if (!modal) return;

  const steps = Array.from(modal.querySelectorAll('.tutorial-step'));
  const dots = Array.from(modal.querySelectorAll('.tutorial-dot'));
  const nextBtn = document.getElementById('btn-tutorial-next');
  const closeBtn = document.getElementById('btn-close-tutorial');
  tutorialTotalSteps = steps.length || 4;

  const showStep = (n) => {
    steps.forEach(s => s.classList.toggle('active', Number(s.dataset.step) === n));
    dots.forEach(d => d.classList.toggle('active', Number(d.dataset.dot) === n));
    nextBtn.innerHTML = n >= tutorialTotalSteps
      ? 'Mulai Main! <i class="fa-solid fa-play"></i>'
      : 'Lanjut <i class="fa-solid fa-arrow-right"></i>';
  };

  const finishTutorial = () => {
    storage.markTutorialSeen();
    modal.classList.add('hidden');
    audio.playButtonClick();
    const cb = tutorialOnComplete;
    tutorialOnComplete = null;
    if (cb) cb();
  };

  nextBtn.addEventListener('click', () => {
    audio.playButtonClick();
    if (tutorialStep >= tutorialTotalSteps) {
      finishTutorial();
    } else {
      tutorialStep++;
      showStep(tutorialStep);
    }
  });

  closeBtn?.addEventListener('click', finishTutorial);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) finishTutorial();
  });
}

function openTutorial(onComplete) {
  const modal = document.getElementById('modal-tutorial');
  if (!modal) { if (onComplete) onComplete(); return; }
  tutorialStep = 1;
  tutorialOnComplete = onComplete;
  modal.querySelectorAll('.tutorial-step').forEach(s => s.classList.toggle('active', s.dataset.step === '1'));
  modal.querySelectorAll('.tutorial-dot').forEach(d => d.classList.toggle('active', d.dataset.dot === '1'));
  const nextBtn = document.getElementById('btn-tutorial-next');
  if (nextBtn) nextBtn.innerHTML = 'Lanjut <i class="fa-solid fa-arrow-right"></i>';
  modal.classList.remove('hidden');
}

/* -------- Post-menu game start sequence (profile setup, popups) -------- */
function startGameFlow() {
  const challengeModal = document.getElementById('modal-challenge');
  const showChallenge = () => {
    if (!challengeModal) return;
    setTimeout(() => challengeModal.classList.remove('hidden'), 500);
  };

  if (!storage.hasProfile()) {
    setTimeout(() => {
      ui.openProfileSetup();
      document.getElementById('btn-save-profile')?.addEventListener('click', showChallenge, { once: true });
    }, 500);
  } else {
    ui.showAlert(`Selamat datang lagi, ${storage.state.playerName}! 🎣`, '👋');
    showChallenge();
  }
}

/* -------- Main Menu / Pause Menu / Settings / Credits wiring -------- */
function setupMenus() {
  const mainMenu  = document.getElementById('screen-mainmenu');
  const pauseMenu = document.getElementById('screen-pausemenu');
  const challengeModal = document.getElementById('modal-challenge');

  // Apply the saved language to every data-i18n tagged element right away
  applyLanguage(storage.state.language || 'id');

  // Challenge popup close handlers (independent of menu state)
  if (challengeModal) {
    const closeChallenge = () => challengeModal.classList.add('hidden');
    document.getElementById('btn-close-challenge')?.addEventListener('click', closeChallenge);
    document.getElementById('btn-challenge-ok')?.addEventListener('click', closeChallenge);
    challengeModal.addEventListener('click', (e) => {
      if (e.target === challengeModal) closeChallenge();
    });
  }

  // "MULAI" vs "LANJUTKAN" depending on whether a profile already exists
  const startLabel = document.getElementById('btn-menu-start-label');
  if (startLabel) startLabel.textContent = storage.hasProfile() ? t('menu_continue') : t('menu_start');

  const enterGame = () => {
    mainMenu.classList.add('hidden');
    gamePaused = false;

    const afterIntroDialog = () => {
      if (!storage.hasSeenTutorial()) {
        openTutorial(() => startGameFlow());
      } else {
        startGameFlow();
      }
    };

    if (!storage.hasSeenIntroDialog()) {
      openIntroDialog(afterIntroDialog);
    } else {
      afterIntroDialog();
    }
  };
  document.getElementById('btn-menu-start')?.addEventListener('click', enterGame);

  document.getElementById('btn-menu-quit')?.addEventListener('click', () => {
    window.close();
    setTimeout(() => {
      ui.showAlert('Silakan tutup tab browser untuk keluar 👋', '🚪');
    }, 200);
  });

  // Pause button (in-game HUD)
  document.getElementById('btn-pause')?.addEventListener('click', () => {
    if (mainMenu && !mainMenu.classList.contains('hidden')) return; // menu already open
    gamePaused = true;
    pauseMenu.classList.remove('hidden');
    audio.playButtonClick();
  });

  document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
    pauseMenu.classList.add('hidden');
    gamePaused = false;
    audio.playButtonClick();
  });

  document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
    if (window.confirm('Restart game? Progress tersimpan tetap aman, hanya memuat ulang halaman.')) {
      window.location.reload();
    }
  });

  document.getElementById('btn-pause-mainmenu')?.addEventListener('click', () => {
    pauseMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    gamePaused = true;
    engine?.resetToIdle();
    audio.playButtonClick();
  });

  // Shared Settings panel (openable from either menu)
  const syncSettingsUI = () => {
    const soundBtn = document.getElementById('settings-toggle-sound');
    if (soundBtn) {
      soundBtn.textContent = storage.state.soundEnabled ? 'ON' : 'OFF';
      soundBtn.classList.toggle('off', !storage.state.soundEnabled);
    }
    const isLow = storage.state.graphicsQuality === 'low';
    document.getElementById('settings-quality-high')?.classList.toggle('active', !isLow);
    document.getElementById('settings-quality-low')?.classList.toggle('active', isLow);

    const sens = storage.state.cameraSensitivity || 'sedang';
    document.getElementById('settings-sens-low')?.classList.toggle('active', sens === 'rendah');
    document.getElementById('settings-sens-mid')?.classList.toggle('active', sens === 'sedang');
    document.getElementById('settings-sens-high')?.classList.toggle('active', sens === 'tinggi');

    const langSelect = document.getElementById('settings-language');
    if (langSelect) langSelect.value = storage.state.language || 'id';
  };

  const openSettings = () => {
    audio.playButtonClick();
    syncSettingsUI();
    document.getElementById('modal-settings')?.classList.remove('hidden');
  };
  document.getElementById('btn-menu-settings')?.addEventListener('click', openSettings);
  document.getElementById('btn-pause-settings')?.addEventListener('click', openSettings);
  document.getElementById('btn-close-settings')?.addEventListener('click', () => {
    document.getElementById('modal-settings')?.classList.add('hidden');
    audio.playButtonClick();
  });

  document.getElementById('settings-toggle-sound')?.addEventListener('click', () => {
    storage.toggleSound();
    audio.updateSoundState();
    audio.playButtonClick();
    syncSettingsUI();
  });
  document.getElementById('settings-quality-high')?.addEventListener('click', () => {
    storage.setGraphicsQuality('high');
    env.setGraphicsQuality('high');
    audio.playButtonClick();
    syncSettingsUI();
  });
  document.getElementById('settings-quality-low')?.addEventListener('click', () => {
    storage.setGraphicsQuality('low');
    env.setGraphicsQuality('low');
    audio.playButtonClick();
    syncSettingsUI();
  });

  document.getElementById('settings-sens-low')?.addEventListener('click', () => {
    storage.setCameraSensitivity('rendah');
    playerController.setSensitivity(CAMERA_SENSITIVITY_MAP.rendah);
    audio.playButtonClick();
    syncSettingsUI();
  });
  document.getElementById('settings-sens-mid')?.addEventListener('click', () => {
    storage.setCameraSensitivity('sedang');
    playerController.setSensitivity(CAMERA_SENSITIVITY_MAP.sedang);
    audio.playButtonClick();
    syncSettingsUI();
  });
  document.getElementById('settings-sens-high')?.addEventListener('click', () => {
    storage.setCameraSensitivity('tinggi');
    playerController.setSensitivity(CAMERA_SENSITIVITY_MAP.tinggi);
    audio.playButtonClick();
    syncSettingsUI();
  });

  document.getElementById('settings-language')?.addEventListener('change', (e) => {
    const lang = e.target.value;
    storage.setLanguage(lang);
    applyLanguage(lang);
    audio.playButtonClick();

    // Refresh text that's managed dynamically in JS (not a static
    // data-i18n element, since its content depends on game state too).
    const startLabelEl = document.getElementById('btn-menu-start-label');
    if (startLabelEl) startLabelEl.textContent = storage.hasProfile() ? t('menu_continue') : t('menu_start');
    playerController?.updateBoatPrompt();
  });

  document.getElementById('btn-npc-chat')?.addEventListener('click', () => {
    audio.playButtonClick();
    openRepeatableNpcChat();
  });

  // Shared Credits panel
  const openCredits = () => {
    audio.playButtonClick();
    document.getElementById('modal-credits')?.classList.remove('hidden');
  };
  document.getElementById('btn-menu-credits')?.addEventListener('click', openCredits);
  document.getElementById('btn-pause-credits')?.addEventListener('click', openCredits);
  document.getElementById('btn-close-credits')?.addEventListener('click', () => {
    document.getElementById('modal-credits')?.classList.add('hidden');
    audio.playButtonClick();
  });

  // Apply the saved graphics setting immediately (renderer already exists)
  if (storage.state.graphicsQuality === 'low') env.setGraphicsQuality('low');

  // Apply the saved camera sensitivity immediately
  const savedSens = CAMERA_SENSITIVITY_MAP[storage.state.cameraSensitivity] || 1.0;
  playerController.setSensitivity(savedSens);
}

function animate(now) {
  requestAnimationFrame(animate);
  const tSec = now * 0.001;
  const dt = Math.min(tSec - lastTime, 0.1);
  lastTime = tSec;

  if (!gamePaused) {
    if (playerController && engine)
      playerController.update(dt, engine.state === 'IDLE');
    engine?.update(dt);
    updateNpcChatPrompt();
  }

  // The world (day/night, water, weather) keeps animating even while paused
  // so the Main/Pause menu has a living background.
  env?.update(tSec, dt);
  env?.render();
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', init);
else
  init();
