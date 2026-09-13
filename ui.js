/* ==========================================================
   Gigit Masalah (Fish It Style) - DOM UI & Hotbar Controller
   ========================================================== */

import * as THREE from 'three';
import { storage, ACHIEVEMENT_DEFS } from './storage.js';
import { audio } from './audio.js';
import { FISH_SPECIES, createVoxelFishModel, createVoxelJunkModel } from './voxelModels.js';
import { tryLoadCustomModelFor } from './modelLoader.js';
import { t } from './i18n.js';

export const SHOP_RODS = [
  { 
    id: 'rod_wooden', 
    name: 'Kail Kayu Kadal', 
    price: 0, 
    power: '1.0x',
    control: 30,
    resilience: 20,
    luckBonus: 0,
    desc: 'Pancingan dasar bertema kadal.' 
  },
  { 
    id: 'rod_bamboo', 
    name: 'Kail Sisik Bambu', 
    price: 150, 
    power: '1.3x',
    control: 40,
    resilience: 35,
    luckBonus: 5,
    desc: 'Lentur dan lebih ringan dilempar.' 
  },
  { 
    id: 'rod_carbon', 
    name: 'Kail Karbon Komodo', 
    price: 400, 
    power: '1.7x',
    control: 55,
    resilience: 50,
    luckBonus: 10,
    desc: 'Kuat menahan tarikan kadal raksasa.' 
  },
  { 
    id: 'rod_golden', 
    name: 'Kail Lidah Kadal', 
    price: 900, 
    power: '2.2x',
    control: 70,
    resilience: 70,
    luckBonus: 15,
    desc: 'Cepat menarik perhatian kadal rare.' 
  },
  { 
    id: 'rod_cosmic', 
    name: 'Joran Emas Gigit Masalah', 
    price: 2000, 
    power: '3.0x',
    control: 90,
    resilience: 90,
    luckBonus: 25,
    desc: 'Joran legenda penakluk leviathan purba.' 
  }
];

export const SHOP_BAITS = [
  { id: 'worm', name: 'Cacing Rawa (x20)', price: 10, count: 20, desc: 'Umpan dasar favorit kadal air.' },
  { id: 'glowing', name: 'Serangga Neon (x5)', price: 40, count: 5, desc: 'Mempercepat gigitan & menarik Kadal Rare.' },
  { id: 'golden', name: 'Umpan Telur Kadal (x5)', price: 100, count: 5, desc: 'Peluang tinggi Kadal Komodo & Hiu.' },
  { id: 'magnet', name: 'Umpan Magnet Purba (x3)', price: 250, count: 3, desc: 'Peluang tinggi mendapat Kadal Glitched Mythic.' }
];

// Local leaderboard "Top Tangkapan" — fixed dummy rivals (no backend/server
// involved) so the board stays stable across sessions. The real player's
// own score is merged in and sorted alongside these at render time.
const DUMMY_LEADERBOARD = [
  { name: 'KadalHunter99', catches: 812 },
  { name: 'RajaSungaiTua', catches: 645 },
  { name: 'MancingSanti', catches: 530 },
  { name: 'BiawakBoss', catches: 410 },
  { name: 'SiKomodo_ID', catches: 355 },
  { name: 'GlowfishHunter', catches: 290 },
  { name: 'PemancingPagi', catches: 205 },
  { name: 'AnakSungai07', catches: 140 },
  { name: 'NubiKail', catches: 60 }
];

export class UIManager {
  constructor(gameEngineGetter) {
    this.getEngine = gameEngineGetter;
    this.isReelInput = false;

    // DOM Elements
    this.coinCountEl = document.getElementById('coin-count');
    this.rodNameEl = document.getElementById('rod-name');
    this.baitCountEl = document.getElementById('bait-count');
    this.playerLevelEl = document.getElementById('player-level');
    this.xpBarFillEl = document.getElementById('xp-bar-fill');
    this.xpTextEl = document.getElementById('xp-text');

    this.castMeterContainer = document.getElementById('cast-meter-container');
    this.castMeterFill = document.getElementById('cast-meter-fill');

    this.reelingContainer = document.getElementById('reeling-minigame');
    this.reelPlayerBar = document.getElementById('reel-player-bar');
    this.reelTargetZone = document.getElementById('reel-target-zone');
    this.tensionFill = document.getElementById('tension-fill');

    this.statusAlert = document.getElementById('game-status-alert');
    this.statusMessage = document.getElementById('status-message');
    this.statusIcon = document.getElementById('status-icon');

    this.btnCast = document.getElementById('btn-cast-action');
    this.castBtnText = document.getElementById('cast-btn-text');

    this.setupEventListeners();
    this.updateHUD();

    // Tracks the currently-running 3D catch-preview renderer/RAF loop so
    // it can be torn down before the next one starts (fixes a leak where
    // every catch spawned a new WebGLRenderer + requestAnimationFrame loop
    // that never stopped).
    this._previewRenderer = null;
    this._previewAnimId = null;
    this._catchStealTimeout = null;
    this._toastTimeout = null;
  }

  setupEventListeners() {
    const handleCastStart = (e) => {
      e.preventDefault();
      const engine = this.getEngine();
      if (engine.state === 'IDLE') {
        engine.startAiming();
      } else if (engine.state === 'BITING' || engine.state === 'WAITING') {
        engine.attemptHook();
      } else if (engine.state === 'REELING') {
        this.isReelInput = true;
      }
    };

    const handleCastEnd = (e) => {
      e.preventDefault();
      const engine = this.getEngine();
      if (engine.state === 'AIMING') {
        engine.releaseCast();
      }
      this.isReelInput = false;
    };

    this.btnCast.addEventListener('mousedown', handleCastStart);
    this.btnCast.addEventListener('mouseup', handleCastEnd);
    this.btnCast.addEventListener('touchstart', handleCastStart, { passive: false });
    this.btnCast.addEventListener('touchend', handleCastEnd, { passive: false });

    // Shake button event
    const shakeBtn = document.getElementById('shake-button');
    if (shakeBtn) {
      shakeBtn.addEventListener('click', () => {
        const engine = this.getEngine();
        engine.onShakeClick();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && !e.target.closest('input, textarea')) {
        handleCastStart(e);
      }
    });
    window.addEventListener('keyup', (e) => {
      // Always allowed to resolve an in-progress cast, even if focus
      // happens to be in an input (e.g. the profile modal auto-opening
      // mid-hold) — otherwise AIMING state could get stuck forever.
      if (e.code === 'Space') {
        handleCastEnd(e);
      }
    });

    // Fish It Hotbar Slots
    const slotRod = document.getElementById('slot-rod');
    if (slotRod) slotRod.addEventListener('click', () => this.openShop());

    const slotBait = document.getElementById('slot-bait');
    if (slotBait) slotBait.addEventListener('click', () => this.openShop());

    const slotAuto = document.getElementById('slot-auto');
    if (slotAuto) {
      slotAuto.addEventListener('click', () => {
        const engine = this.getEngine();
        const isEnabled = engine.toggleAutoCast();
        
        if (isEnabled) {
          slotAuto.classList.add('active');
          this.showAlert('Auto-Cast AKTIF! 🤖', '✅');
        } else {
          slotAuto.classList.remove('active');
          this.showAlert('Auto-Cast NONAKTIF', 'ℹ️');
        }
        audio.playButtonClick();
      });
    }

    const btnSound = document.getElementById('btn-sound');
    btnSound.addEventListener('click', () => {
      const enabled = storage.toggleSound();
      btnSound.innerHTML = enabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
      audio.updateSoundState();
      audio.playButtonClick();
    });

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        audio.playButtonClick();
        const confirmed = window.confirm('Reset semua progress (koin, level, koleksi, misi)? Ini tidak bisa dibatalkan.');
        if (confirmed) {
          storage.resetProgress();
          window.location.reload();
        }
      });
    }

    document.getElementById('hud-avatar-btn').addEventListener('click', () => this.openProfileSetup());
    document.getElementById('btn-close-profile').addEventListener('click', () => this.closeModal('modal-profile'));

    const photoInput = document.getElementById('profile-photo-input');
    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await this.resizeImageToDataURL(file, 200);
        document.getElementById('profile-photo-preview').src = dataUrl;
        this._pendingAvatar = dataUrl;
      } catch (err) {
        console.error('Failed to process photo:', err);
      }
    });

    document.getElementById('btn-save-profile').addEventListener('click', () => {
      const nameInput = document.getElementById('profile-name-input');
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      const wasFirstTime = !storage.hasProfile();
      storage.setProfile(name, this._pendingAvatar || null);
      this._pendingAvatar = null;
      audio.playButtonClick();
      this.updateHUD();
      this.closeModal('modal-profile');
      if (!wasFirstTime) {
        this.showAlert(`Profil diperbarui! Halo, ${storage.state.playerName}! 👋`, '✅');
      }
    });

    document.getElementById('btn-shop').addEventListener('click', () => this.openShop());
    document.getElementById('btn-close-shop').addEventListener('click', () => this.closeModal('modal-shop'));

    document.getElementById('btn-fishdex').addEventListener('click', () => this.openFishdex());
    document.getElementById('btn-close-fishdex').addEventListener('click', () => this.closeModal('modal-fishdex'));

    document.getElementById('btn-progress').addEventListener('click', () => this.openProgress());
    document.getElementById('btn-close-progress').addEventListener('click', () => this.closeModal('modal-progress'));
    document.getElementById('btn-claim-mission').addEventListener('click', () => {
      const claimed = storage.claimDailyMission();
      if (claimed) {
        audio.playCoinSound();
        this.updateHUD();
        this.showAlert('Hadiah misi diklaim! 🎯', '🎉');
        this.renderMissionTab();
      }
    });

    const progressTabs = document.querySelectorAll('.progress-tab');
    progressTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        progressTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetTab = tab.dataset.tab;
        document.getElementById('progress-mission-panel').classList.toggle('hidden', targetTab !== 'mission');
        document.getElementById('progress-achievements-panel').classList.toggle('hidden', targetTab !== 'achievements');
        document.getElementById('progress-leaderboard-panel').classList.toggle('hidden', targetTab !== 'leaderboard');
        audio.playButtonClick();
      });
    });

    const tabs = document.querySelectorAll('.shop-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetTab = tab.dataset.tab;
        document.getElementById('shop-rods-list').classList.toggle('hidden', targetTab !== 'rods');
        document.getElementById('shop-baits-list').classList.toggle('hidden', targetTab !== 'baits');
        audio.playButtonClick();
      });
    });

    document.getElementById('btn-sell-fish').addEventListener('click', () => {
      const engine = this.getEngine();
      if (engine.caughtFish) {
        this.clearCatchSteal();
        storage.removeFromInventory(engine.caughtFish.id);
        storage.addCoins(engine.caughtFish.price);
        storage.progressDailyMission('sell_fish', 1);
        audio.playCoinSound();
        this.updateHUD();
        this.closeModal('modal-catch');
        engine.resetToIdle();
      }
    });

    document.getElementById('btn-keep-fish').addEventListener('click', () => {
      const engine = this.getEngine();
      this.clearCatchSteal();
      audio.playButtonClick();
      this.showAlert('Disimpan ke Tas Barang! 🎒', '✅');
      this.closeModal('modal-catch');
      engine.resetToIdle();
    });

    document.getElementById('btn-inventory').addEventListener('click', () => this.openInventory());
    document.getElementById('btn-close-inventory').addEventListener('click', () => this.closeModal('modal-inventory'));
  }

  isReelInputActive() {
    return this.isReelInput;
  }

  setAutoCastButtonState(enabled) {
    const slotAuto = document.getElementById('slot-auto');
    if (slotAuto) slotAuto.classList.toggle('active', enabled);
  }

  getCurrentRodStats() {
    const rodId = storage.state.equippedRod;
    const rod = SHOP_RODS.find(r => r.id === rodId);
    return rod || SHOP_RODS[0];
  }

  showCastQuality(quality) {
    const qualityPopup = document.getElementById('cast-quality-popup');
    const qualityText = document.getElementById('cast-quality-text');
    const qualityBonus = document.getElementById('cast-quality-bonus');
    
    qualityText.textContent = quality;
    
    if (quality === 'PERFECT!') {
      qualityPopup.className = 'cast-quality-popup perfect';
      qualityBonus.textContent = '+50% XP & +10💰 Bonus!';
      qualityBonus.classList.remove('hidden');
    } else {
      qualityPopup.className = 'cast-quality-popup';
      qualityBonus.classList.add('hidden');
    }
    
    qualityPopup.classList.remove('hidden');
    
    setTimeout(() => {
      qualityPopup.classList.add('hidden');
    }, 2000);
  }

  showShakeButton() {
    const shakeBtn = document.getElementById('shake-button');
    this.repositionShakeButton();
    shakeBtn.classList.remove('hidden');
    
    const shakeProgress = document.getElementById('shake-progress');
    const engine = this.getEngine();
    shakeProgress.textContent = `${engine.shakeCount}/${engine.maxShakes}`;
  }

  repositionShakeButton() {
    const shakeBtn = document.getElementById('shake-button');
    const left = 20 + Math.random() * 60; // 20-80%
    const top = 25 + Math.random() * 50;  // 25-75%
    shakeBtn.style.left = `${left}%`;
    shakeBtn.style.top = `${top}%`;
    
    const engine = this.getEngine();
    const shakeProgress = document.getElementById('shake-progress');
    shakeProgress.textContent = `${engine.shakeCount}/${engine.maxShakes}`;
  }

  hideShakeButton() {
    const shakeBtn = document.getElementById('shake-button');
    shakeBtn.classList.add('hidden');
  }

  showTensionWarning() {
    const tensionFill = document.getElementById('tension-fill');
    tensionFill.classList.add('danger-pulse');
  }

  showLineBreakEffect() {
    // Show dramatic line break animation
    const reelingContainer = document.getElementById('reeling-minigame');
    reelingContainer.classList.add('line-break-shake');
    
    setTimeout(() => {
      reelingContainer.classList.remove('line-break-shake');
    }, 500);
  }

  flashDamage() {
    const flash = document.getElementById('damage-flash');
    if (!flash) return;
    flash.classList.remove('flash-active');
    void flash.offsetWidth; // force reflow so the animation can replay back-to-back
    flash.classList.add('flash-active');
  }

  updateHUD() {
    this.coinCountEl.textContent = storage.state.coins;
    this.playerLevelEl.textContent = storage.state.level;

    const nameEl = document.getElementById('hud-player-name');
    if (nameEl) nameEl.textContent = storage.state.playerName || 'Pemancing';
    const avatarImg = document.getElementById('hud-avatar-img');
    if (avatarImg && storage.state.playerAvatar) avatarImg.src = storage.state.playerAvatar;

    const xpPercent = Math.min(100, (storage.state.xp / storage.state.maxXp) * 100);
    this.xpBarFillEl.style.width = `${xpPercent}%`;
    this.xpTextEl.textContent = `${storage.state.xp} / ${storage.state.maxXp} XP`;

    const rodObj = SHOP_RODS.find(r => r.id === storage.state.equippedRod);
    this.rodNameEl.textContent = rodObj ? rodObj.name : 'Kail Kayu Kadal';

    const currentBait = storage.state.equippedBait;
    const baitCount = storage.state.baits[currentBait] || 0;
    const baitObj = SHOP_BAITS.find(b => b.id === currentBait);
    const baitName = baitObj ? baitObj.name.split(' ')[0] : 'Cacing';
    this.baitCountEl.textContent = `${baitName} x${baitCount}`;
  }

  onAimingStart() {
    this.castMeterContainer.classList.remove('hidden');
    this.castBtnText.textContent = t('hud_cast_release');
    this.btnCast.classList.remove('idle-pulse');
  }

  onAimingEnd() {
    this.castMeterContainer.classList.add('hidden');
    this.castBtnText.textContent = t('hud_cast_idle');
    this.btnCast.classList.add('idle-pulse');
  }

  updateCastPower(percent) {
    this.castMeterFill.style.width = `${percent}%`;
  }

  showBiteAlert() {
    this.statusMessage.textContent = 'GIGIT MASALAH! KLIK SEKARANG!';
    this.statusIcon.textContent = '🐟';
    this.statusAlert.classList.remove('hidden');
  }

  hideBiteAlert() {
    this.statusAlert.classList.add('hidden');
  }

  showReelingMinigame() {
    this.reelingContainer.classList.remove('hidden');
    this.castBtnText.textContent = t('hud_cast_hold_reel');
  }

  hideReelingMinigame() {
    this.reelingContainer.classList.add('hidden');
    this.castBtnText.textContent = t('hud_cast_idle');
    this.tensionFill.classList.remove('danger-pulse');
  }

  updateReelHUD(playerPos, targetPos, progress, tension) {
    this.reelPlayerBar.style.bottom = `${playerPos}%`;
    this.reelTargetZone.style.bottom = `${targetPos}%`;

    this.tensionFill.style.width = `${tension}%`;
    if (tension > 70) {
      this.tensionFill.style.backgroundColor = '#ef4444';
    } else if (tension > 40) {
      this.tensionFill.style.backgroundColor = '#f59e0b';
    } else {
      this.tensionFill.style.backgroundColor = '#10b981';
    }
  }

  showAlert(msg, icon = 'ℹ️') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    let type = 'info';
    if (icon === '❌' || icon === '⚠️' || icon === '🚫') type = 'error';
    else if (icon === '✅' || icon === '🎉' || icon === '🏅' || icon === '⭐' || icon === '👋') type = 'success';

    document.getElementById('toast-icon').textContent = icon;
    document.getElementById('toast-message').textContent = msg;
    toast.className = `toast-notification toast-show toast-${type}`;

    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('toast-show');
    }, 2600);
  }

  showCatchModal(fish) {
    const modal = document.getElementById('modal-catch');
    document.getElementById('catch-rarity').textContent = fish.isJunk ? 'SAMPAH' : fish.rarity.toUpperCase();
    document.getElementById('catch-rarity').style.backgroundColor = fish.rarityColor;
    document.getElementById('catch-name').textContent = fish.name;
    document.getElementById('catch-price').textContent = `${fish.price} Coins`;
    document.getElementById('catch-xp').textContent = `+${fish.xpReward} XP`;
    document.getElementById('catch-desc').textContent = fish.desc;

    // "Boss tier" = any Legendary/Mythic catch. The two specific Mythic
    // species (isChallengeWin) additionally get the real IG-contest
    // banner; every other Legendary/Mythic still gets the bigger
    // celebration treatment, just with a lighter in-game-only badge.
    const isBossTier = !fish.isJunk && (fish.rarity === 'Legendary' || fish.rarity === 'Mythic');

    const jackpotBanner = document.getElementById('catch-jackpot-banner');
    jackpotBanner.classList.toggle('hidden', !fish.isChallengeWin);

    const bossBadge = document.getElementById('catch-boss-badge');
    bossBadge.classList.toggle('hidden', !(isBossTier && !fish.isChallengeWin));

    if (fish.isChallengeWin || isBossTier) {
      audio.playCatchFanfare();
      this.flashCelebration();
    }

    const weightStat = document.getElementById('catch-weight-stat');
    const conditionStat = document.getElementById('catch-condition-stat');

    if (fish.isJunk) {
      weightStat.classList.add('hidden');
      conditionStat.classList.remove('hidden');
      const conditions = ['Butut Parah', 'Lumayan Karatan', 'Masih Lumayan', 'Bau Sungai', 'Berlumut Tebal'];
      document.getElementById('catch-condition').textContent =
        conditions[Math.floor(Math.random() * conditions.length)];
    } else {
      conditionStat.classList.add('hidden');
      weightStat.classList.remove('hidden');
      document.getElementById('catch-weight').textContent = `${fish.weight} kg`;
    }

    // Show the modal FIRST so the preview container has real dimensions
    // (a hidden/display:none container reports 0x0, which produced a
    // blank renderer before).
    modal.classList.remove('hidden');
    this.renderFish3DPreview(fish);

    // Restart the reveal animation every time a new catch is shown.
    const box = modal.querySelector('.modal-box');
    box.classList.remove('catch-reveal', 'catch-reveal-jackpot');
    void box.offsetWidth; // force reflow so the animation can replay
    box.classList.add((fish.isChallengeWin || isBossTier) ? 'catch-reveal-jackpot' : 'catch-reveal');

    // Arm the "bird steals it" risk for common/junk catches left sitting
    // in this modal too long (see armCatchSteal for the rarity gate).
    this.armCatchSteal(fish);
  }

  flashCelebration() {
    const flash = document.getElementById('celebration-flash');
    if (!flash) return;
    flash.classList.remove('flash-active');
    void flash.offsetWidth;
    flash.classList.add('flash-active');
  }

  /* ── "Burung nyolong ikan" — a comedic low-stakes risk: leave a
     junk/Common catch sitting unclaimed too long and a bird swipes it
     before you can sell/keep it. Never applies to Rare+ catches. ──── */
  armCatchSteal(fish) {
    this.clearCatchSteal();
    const stealable = fish.isJunk || fish.rarity === 'Common';
    if (!stealable) return;

    const delay = 9000 + Math.random() * 6000; // 9–15s of "lengah"
    this._catchStealTimeout = setTimeout(() => this.stealCatch(fish), delay);
  }

  clearCatchSteal() {
    if (this._catchStealTimeout) {
      clearTimeout(this._catchStealTimeout);
      this._catchStealTimeout = null;
    }
  }

  stealCatch(fish) {
    const modal = document.getElementById('modal-catch');
    if (!modal || modal.classList.contains('hidden')) return; // already handled

    // The bird only grabs the physical item — the catch still counted
    // toward XP/missions/achievements, it's just gone before it could
    // be sold or kept.
    storage.removeFromInventory(fish.id, 1);
    this.updateHUD();

    this.closeModal('modal-catch'); // also stops the 3D preview loop
    this.getEngine()?.resetToIdle();

    this.showAlert('🐦 Ikannya dicolong burung pas kamu lengah!', '🐦');
  }

  async renderFish3DPreview(fish) {
    const container = document.getElementById('catch-preview-container');

    // Stop the previous preview's render loop and free its WebGL context
    // FIRST. Without this, every new catch left the old renderer running
    // forever in the background — a growing pile of active RAF loops and
    // WebGL contexts that made the game get slower/hotter the longer you
    // played, and could eventually corrupt future previews.
    this.disposeFish3DPreview();
    container.querySelectorAll('canvas').forEach(c => c.remove());

    let loadingEl = container.querySelector('.preview-loading');
    if (!loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.className = 'preview-loading';
      loadingEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat model...';
      container.appendChild(loadingEl);
    }
    loadingEl.classList.remove('hidden');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1, 5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    this._previewRenderer = renderer;

    const light = new THREE.DirectionalLight(0xffffff, 1.8);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.9));

    // Try a custom .glb model first (if one is configured for this id),
    // otherwise use the built-in low-poly model.
    let previewModel = await tryLoadCustomModelFor(fish.id);
    loadingEl.classList.add('hidden');

    // Bail out if the modal got closed while the model was loading.
    if (!container.isConnected) {
      this.disposeFish3DPreview();
      return;
    }

    if (!previewModel) {
      previewModel = fish.isJunk ? createVoxelJunkModel(fish.id) : createVoxelFishModel(fish.id);
    } else {
      // Normalize custom model scale/position roughly into view.
      const box = new THREE.Box3().setFromObject(previewModel);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetSize = 1.4;
      previewModel.scale.multiplyScalar(targetSize / maxDim);
      const center = new THREE.Vector3();
      box.getCenter(center);
      previewModel.position.sub(center.multiplyScalar(targetSize / maxDim));
    }
    scene.add(previewModel);

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      this._previewAnimId = animId;
      previewModel.rotation.y += 0.02;
      previewModel.rotation.x = Math.sin(Date.now() * 0.002) * 0.15;
      renderer.render(scene, camera);
    };
    animate();
  }

  /**
   * Stops the running catch-preview RAF loop (if any) and fully releases
   * its WebGLRenderer/GPU context. Must be called before starting a new
   * preview and whenever the catch modal is closed, or old preview loops
   * pile up in the background forever.
   */
  disposeFish3DPreview() {
    if (this._previewAnimId !== null) {
      cancelAnimationFrame(this._previewAnimId);
      this._previewAnimId = null;
    }
    if (this._previewRenderer) {
      this._previewRenderer.dispose();
      // Actively free the underlying GPU context instead of waiting for
      // garbage collection — this is what actually prevents the "too many
      // WebGL contexts" browser warning/glitching after many catches.
      this._previewRenderer.forceContextLoss?.();
      this._previewRenderer.domElement?.remove();
      this._previewRenderer = null;
    }
  }

  openShop() {
    audio.playButtonClick();
    this.renderShopRods();
    this.renderShopBaits();
    document.getElementById('modal-shop').classList.remove('hidden');
  }

  renderShopRods() {
    const container = document.getElementById('shop-rods-list');
    container.innerHTML = '';

    SHOP_RODS.forEach(rod => {
      const isUnlocked = storage.state.unlockedRods.includes(rod.id);
      const isEquipped = storage.state.equippedRod === rod.id;

      const card = document.createElement('div');
      card.className = `shop-item-card ${isEquipped ? 'equipped' : ''}`;
      card.innerHTML = `
        <div class="item-icon">🎣</div>
        <div class="item-info">
          <h4>${rod.name}</h4>
          <p>${rod.desc}</p>
          <div class="rod-stats-display">
            <div class="stat-row">
              <span class="stat-label">Control:</span>
              <div class="stat-bar-mini">
                <div class="stat-fill" style="width: ${rod.control}%"></div>
              </div>
              <span class="stat-value">${rod.control}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Resilience:</span>
              <div class="stat-bar-mini">
                <div class="stat-fill resilience" style="width: ${rod.resilience}%"></div>
              </div>
              <span class="stat-value">${rod.resilience}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Luck:</span>
              <span class="stat-value gold">+${rod.luckBonus}%</span>
            </div>
          </div>
        </div>
        <div class="item-action">
          ${isEquipped ? '<button class="hd-btn secondary-btn" disabled>TERPAKAI</button>' :
            (isUnlocked ? `<button class="hd-btn primary-action-btn equip-rod-btn" data-id="${rod.id}">PAKAI</button>` :
            `<button class="hd-btn gold-btn buy-rod-btn" data-id="${rod.id}"><i class="fa-solid fa-coins"></i> ${rod.price}</button>`)
          }
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.buy-rod-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rodId = e.currentTarget.dataset.id;
        const rod = SHOP_RODS.find(r => r.id === rodId);
        if (storage.deductCoins(rod.price)) {
          storage.unlockRod(rodId);
          storage.equipRod(rodId);
          audio.playCoinSound();
          this.updateHUD();
          this.renderShopRods();
          this.getEngine().env.updateRodModel(rodId);
        } else {
          this.showAlert('Koin tidak cukup!', '⚠️');
        }
      });
    });

    container.querySelectorAll('.equip-rod-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rodId = e.currentTarget.dataset.id;
        storage.equipRod(rodId);
        audio.playButtonClick();
        this.updateHUD();
        this.renderShopRods();
        this.getEngine().env.updateRodModel(rodId);
      });
    });
  }

  renderShopBaits() {
    const container = document.getElementById('shop-baits-list');
    container.innerHTML = '';

    SHOP_BAITS.forEach(bait => {
      const currentCount = storage.state.baits[bait.id] || 0;
      const isEquipped = storage.state.equippedBait === bait.id;

      const card = document.createElement('div');
      card.className = `shop-item-card ${isEquipped ? 'equipped' : ''}`;
      card.innerHTML = `
        <div class="item-icon">🪱</div>
        <div class="item-info">
          <h4>${bait.name}</h4>
          <p>${bait.desc}</p>
          <div class="item-stats">Stok Milikmu: ${currentCount}</div>
        </div>
        <div class="item-action">
          <button class="hd-btn gold-btn buy-bait-btn" data-id="${bait.id}"><i class="fa-solid fa-coins"></i> ${bait.price}</button>
          ${!isEquipped
            ? (currentCount > 0
                ? `<button class="hd-btn secondary-btn equip-bait-btn" data-id="${bait.id}">PAKAI</button>`
                : '<button class="hd-btn secondary-btn" disabled>HABIS</button>')
            : '<span style="font-size:0.75rem; font-weight:800; color:#10b981;">AKTIF</span>'}
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.buy-bait-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const baitId = e.currentTarget.dataset.id;
        const bait = SHOP_BAITS.find(b => b.id === baitId);
        if (storage.deductCoins(bait.price)) {
          storage.addBait(baitId, bait.count);
          audio.playCoinSound();
          this.updateHUD();
          this.renderShopBaits();
        } else {
          this.showAlert('Koin tidak cukup!', '⚠️');
        }
      });
    });

    container.querySelectorAll('.equip-bait-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const baitId = e.currentTarget.dataset.id;
        storage.equipBait(baitId);
        audio.playButtonClick();
        this.updateHUD();
        this.renderShopBaits();
      });
    });
  }

  openFishdex() {
    audio.playButtonClick();

    const grid = document.getElementById('fishdex-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Always read the latest LocalStorage-backed state.
    storage.state = storage.load();

    const fishdex = storage.state.fishdex || {};
    let unlockedCount = 0;
    let maxOverallWeight = 0;

    FISH_SPECIES.forEach(species => {
      const entry = fishdex[species.id];
      const isUnlocked = !!(entry && entry.unlocked);

      if (isUnlocked) {
        unlockedCount++;
        maxOverallWeight = Math.max(maxOverallWeight, Number(entry.maxWeight) || 0);
      }

      const card = document.createElement('div');
      card.className = `fishdex-card ${isUnlocked ? '' : 'locked'}`;
      card.innerHTML = `
        <div class="fish-symbol">${isUnlocked ? (species.symbol || '🐟') : '❓'}</div>
        <div class="fish-name">${isUnlocked ? species.name : '???'}</div>
        <div class="fish-rarity" style="background-color:${species.rarityColor || '#64748b'}">${species.rarity}</div>
        <div style="font-size:0.7rem; color:#cbd5e1; margin-top:4px;">
          ${isUnlocked
            ? `Tertangkap: ${entry.count || 0}x<br>Rekor: ${entry.maxWeight || 0} kg`
            : 'Belum Ditemukan'}
        </div>
      `;
      grid.appendChild(card);
    });

    document.getElementById('fishdex-count').textContent =
      `${unlockedCount}/${FISH_SPECIES.length}`;
    document.getElementById('fishdex-max-weight').textContent =
      `${maxOverallWeight} kg`;

    document.getElementById('modal-fishdex').classList.remove('hidden');
  }

  openProfileSetup() {
    audio.playButtonClick();
    const nameInput = document.getElementById('profile-name-input');
    const preview = document.getElementById('profile-photo-preview');
    nameInput.value = storage.state.playerName || '';
    if (storage.state.playerAvatar) preview.src = storage.state.playerAvatar;
    this._pendingAvatar = null;
    this.renderCharacterStatus();
    document.getElementById('modal-profile').classList.remove('hidden');
  }

  renderCharacterStatus() {
    // Always read the latest LocalStorage-backed state.
    storage.state = storage.load();

    const totalCatches = (storage.state.stats.totalCaught || 0) + (storage.state.stats.totalJunkCaught || 0);
    document.getElementById('profile-status-level').textContent = storage.state.level;
    document.getElementById('profile-status-catches').textContent = totalCatches;
    document.getElementById('profile-status-coins').textContent = storage.state.coins;

    const rod = SHOP_RODS.find(r => r.id === storage.state.equippedRod) || SHOP_RODS[0];
    document.getElementById('profile-status-rodname').textContent = rod.name;

    const statsEl = document.getElementById('profile-status-rodstats');
    statsEl.innerHTML = `
      <div class="stat-row">
        <span class="stat-label">Control:</span>
        <div class="stat-bar-mini"><div class="stat-fill" style="width: ${rod.control}%"></div></div>
        <span class="stat-value">${rod.control}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Resilience:</span>
        <div class="stat-bar-mini"><div class="stat-fill resilience" style="width: ${rod.resilience}%"></div></div>
        <span class="stat-value">${rod.resilience}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Luck:</span>
        <span class="stat-value gold">+${rod.luckBonus}%</span>
      </div>
    `;
  }

  resizeImageToDataURL(file, size = 200) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Center-crop to a square before scaling down
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
      img.src = objectUrl;
    });
  }

  closeModal(modalId) {
    audio.playButtonClick();
    if (modalId === 'modal-catch') this.disposeFish3DPreview();
    document.getElementById(modalId).classList.add('hidden');
  }

  openInventory() {
    audio.playButtonClick();

    const list = document.getElementById('inventory-list');
    const emptyMsg = document.getElementById('inventory-empty');
    list.innerHTML = '';

    // Always read the latest LocalStorage-backed state.
    storage.state = storage.load();
    const inventory = storage.state.inventory || {};
    const items = Object.values(inventory);

    if (items.length === 0) {
      emptyMsg.classList.remove('hidden');
    } else {
      emptyMsg.classList.add('hidden');
      items.sort((a, b) => (a.isJunk === b.isJunk) ? 0 : (a.isJunk ? 1 : -1));

      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'shop-item-card';
        card.innerHTML = `
          <div class="item-icon">${item.symbol || (item.isJunk ? '🗑️' : '🐟')}</div>
          <div class="item-info">
            <h4>${item.name}</h4>
            <p>${item.isJunk ? 'Barang' : 'Ikan'} · Rarity: ${item.rarity}</p>
            <div class="item-stats">Jumlah: x${item.count}${item.isJunk ? '' : ` · Terakhir: ${item.lastWeight} kg`}</div>
          </div>
          <div class="item-action">
            <button class="hd-btn gold-btn inv-sell-btn" data-id="${item.id}"><i class="fa-solid fa-coins"></i> ${item.price}</button>
          </div>
        `;
        list.appendChild(card);
      });

      list.querySelectorAll('.inv-sell-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const itemId = e.currentTarget.dataset.id;
          const entry = storage.state.inventory[itemId];
          if (!entry) return;
          storage.removeFromInventory(itemId, 1);
          storage.addCoins(entry.price);
          storage.progressDailyMission('sell_fish', 1);
          audio.playCoinSound();
          this.updateHUD();
          this.openInventory();
        });
      });
    }

    document.getElementById('modal-inventory').classList.remove('hidden');
  }

  openProgress() {
    audio.playButtonClick();
    storage.state = storage.load();
    this.renderMissionTab();
    this.renderAchievementsTab();
    this.renderLeaderboardTab();
    document.getElementById('modal-progress').classList.remove('hidden');
  }

  renderMissionTab() {
    const mission = storage.ensureDailyMission();
    document.getElementById('mission-label').textContent = mission.label;
    const pct = Math.min(100, (mission.progress / mission.target) * 100);
    document.getElementById('mission-progress-fill').style.width = `${pct}%`;
    document.getElementById('mission-progress-text').textContent =
      `${mission.progress}/${mission.target} · Hadiah: ${mission.reward} Koin`;

    const claimBtn = document.getElementById('btn-claim-mission');
    const ready = mission.progress >= mission.target && !mission.claimed;
    claimBtn.disabled = !ready;
    claimBtn.textContent = mission.claimed
      ? 'Sudah Diklaim ✓'
      : (ready ? 'Klaim Hadiah' : 'Belum Selesai');
  }

  renderAchievementsTab() {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '';
    const unlocked = storage.state.achievements || {};

    ACHIEVEMENT_DEFS.forEach(def => {
      const isUnlocked = !!unlocked[def.id];
      const card = document.createElement('div');
      card.className = `fishdex-card ${isUnlocked ? '' : 'locked'}`;
      card.innerHTML = `
        <div class="fish-symbol">${isUnlocked ? def.icon : '🔒'}</div>
        <div class="fish-name">${def.name}</div>
        <div style="font-size:0.68rem; color:#cbd5e1; margin-top:4px;">${def.desc}</div>
      `;
      grid.appendChild(card);
    });
  }

  renderLeaderboardTab() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';

    const myCatches = (storage.state.stats.totalCaught || 0) + (storage.state.stats.totalJunkCaught || 0);
    const myName = storage.state.playerName || 'Pemancing';

    const entries = [
      ...DUMMY_LEADERBOARD.map(e => ({ ...e, isMe: false })),
      { name: myName, catches: myCatches, isMe: true }
    ].sort((a, b) => b.catches - a.catches);

    entries.forEach((entry, idx) => {
      const rank = idx + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const row = document.createElement('div');
      row.className = `leaderboard-row ${entry.isMe ? 'me' : ''}`;
      row.innerHTML = `
        <span class="leaderboard-rank">${medal}</span>
        <span class="leaderboard-name">${entry.name}${entry.isMe ? ' (Kamu)' : ''}</span>
        <span class="leaderboard-score">${entry.catches} 🐟</span>
      `;
      list.appendChild(row);
    });
  }
}
