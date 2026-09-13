/* ==========================================================
   Gigit Masalah - Main Game Engine
   Minigame Rebalanced: Super Easy, Smooth & Satisfying
   ========================================================== */

import * as THREE from 'three';
import { audio } from './audio.js';
import { storage } from './storage.js';
import { FISH_SPECIES } from './voxelModels.js';

export const GAME_STATE = {
  IDLE: 'IDLE',
  AIMING: 'AIMING',
  CASTING: 'CASTING',
  WAITING: 'WAITING',
  SHAKING: 'SHAKING',
  BITING: 'BITING',
  REELING: 'REELING',
  CAUGHT: 'CAUGHT'
};

export class GameEngine {
  constructor(env, uiCallbacks) {
    this.env = env;
    this.ui = uiCallbacks;
    this.state = GAME_STATE.IDLE;

    // Cast Power physics
    this.castPower = 0;
    this.castPowerDirection = 1;
    this.castQuality = 'Meh..';

    // Bait & Bite timing
    this.waitTimer = 0;
    this.biteTimer = 0;
    this.targetBobberPos = new THREE.Vector3();

    // Shake button mechanic
    this.shakeCount = 0;
    this.maxShakes = 5;

    // Auto cast feature
    this.autoCastEnabled = false;
    this.autoCastDelay = 0;

    // Reeling Minigame parameters
    this.reelProgress = 0;
    this.reelTension = 8;
    this.playerBarPos = 40;
    this.playerBarVel = 0;
    this.targetZonePos = 34;
    this.targetZoneVel = 0.25;

    this.caughtFish = null;
  }

  startAiming() {
    if (this.state !== GAME_STATE.IDLE) return;

    if (!storage.useBait()) {
      this.ui.showAlert('UMPAN HABIS! Beli di Toko.', '⚠️');
      audio.playButtonClick();
      return;
    }

    this.state = GAME_STATE.AIMING;
    this.castPower = 0;
    this.castPowerDirection = 1;
    this.ui.onAimingStart();
  }

  cancelAiming() {
    if (this.state === GAME_STATE.AIMING) {
      this.state = GAME_STATE.IDLE;
      this.ui.onAimingEnd();
    }
  }

  releaseCast() {
    if (this.state !== GAME_STATE.AIMING) return;

    // Compute where the cast would actually land BEFORE committing to it.
    const distance = 6 + (this.castPower / 100) * 18;
    const forwardX = Math.sin(this.env.player.rotation.y);
    const forwardZ = Math.cos(this.env.player.rotation.y);
    const landX = this.env.player.position.x + forwardX * distance;
    const landZ = this.env.player.position.z + forwardZ * distance;

    // Fishing only works if the line actually lands in water — cancel
    // and refund the bait if the cast would land on the pier/island.
    if (this.env.isWaterAt && !this.env.isWaterAt(landX, landZ)) {
      this.state = GAME_STATE.IDLE;
      this.ui.onAimingEnd();
      storage.addBait(storage.state.equippedBait, 1); // refund the bait startAiming() consumed
      this.ui.showAlert('Nggak ada air di sana! Hadap ke arah sungai/laut.', '🚫');
      audio.playButtonClick();
      return;
    }

    // Determine cast quality based on power
    if (this.castPower >= 99 && this.castPower <= 100) {
      this.castQuality = 'PERFECT!';
    } else if (this.castPower >= 86) {
      this.castQuality = 'Amazing!!';
    } else if (this.castPower >= 61) {
      this.castQuality = 'Great!';
    } else if (this.castPower >= 41) {
      this.castQuality = 'Good.';
    } else if (this.castPower >= 21) {
      this.castQuality = 'Fine.';
    } else {
      this.castQuality = 'Meh..';
    }

    this.state = GAME_STATE.CASTING;
    this.ui.onAimingEnd();
    this.ui.showCastQuality(this.castQuality);
    audio.playCast();

    this.targetBobberPos.set(landX, 0, landZ);

    this.castProgress = 0;
    this.castStartPos = this.env.getRodTipWorldPosition();
    this.env.bobber.position.copy(this.castStartPos);
    this.env.bobber.visible = true;
  }

  onBobberLanded() {
    this.state = GAME_STATE.SHAKING;
    this.env.bobberTargetY = 0;
    audio.playSplash();
    this.env.triggerSplash(this.targetBobberPos);

    // Initialize shake mechanic
    this.shakeCount = 0;
    this.maxShakes = 5 + Math.floor(Math.random() * 3); // 5-7 shakes
    this.ui.showShakeButton();

    const forwardX = Math.sin(this.env.player.rotation.y);
    const forwardZ = Math.cos(this.env.player.rotation.y);
    this.env.fishShadow.position.set(
      this.targetBobberPos.x + forwardX * 3,
      0.05,
      this.targetBobberPos.z + forwardZ * 3
    );
    this.env.fishShadow.visible = true;
  }

  onShakeClick() {
    if (this.state !== GAME_STATE.SHAKING) return;
    
    this.shakeCount++;
    audio.playButtonClick();
    
    if (this.shakeCount >= this.maxShakes) {
      // Shaking complete, start waiting for bite
      this.state = GAME_STATE.WAITING;
      this.ui.hideShakeButton();
      
      const baitType = storage.state.equippedBait;
      let biteDelay = 1.5 + Math.random() * 2.0;
      if (baitType === 'glowing') biteDelay *= 0.6;
      if (baitType === 'golden') biteDelay *= 0.4;
      
      this.waitTimer = biteDelay;
    } else {
      // Move shake button to new position
      this.ui.repositionShakeButton();
    }
  }

  triggerBite() {
    this.state = GAME_STATE.BITING;
    this.biteTimer = 2.5; // Generous 2.5 seconds hook window
    audio.playBiteAlert();
    this.env.triggerSplash(this.env.bobber.position);
    this.ui.showBiteAlert();
  }

  attemptHook() {
    if (this.state === GAME_STATE.BITING) {
      this.startReeling();
    } else if (this.state === GAME_STATE.WAITING) {
      this.resetToIdle('Tarik terlalu cepat!');
    }
  }

  startReeling() {
    this.state = GAME_STATE.REELING;
    this.ui.hideBiteAlert();
    this.ui.showReelingMinigame();

    this.caughtFish = this.rollFish();

    // Get current rod stats
    const rodData = this.ui.getCurrentRodStats();
    const control = rodData.control || 30;
    const resilience = rodData.resilience || 20;

    // MOBILE-FRIENDLY REELING MINIGAME
    // Tahan tombol TARIK untuk menaikkan bar.
    // Lepaskan tombol untuk menurunkan bar.
    const rarityDifficulty = {
      Common: 1.00,
      Rare: 1.35,
      Epic: 1.75,
      Legendary: 2.35,
      Mythic: 3.10
    };
    const difficulty = rarityDifficulty[this.caughtFish.rarity] || 1.00;

    this.reelProgress = 0;
    this.reelTension = 18;
    this.playerBarPos = 42;
    this.playerBarVel = 0;
    this.targetZonePos = 38;

    // Fish movement is deliberately readable on mobile.
    this.targetZoneVel = 0.48 * difficulty;
    this.fishDifficulty = difficulty;
    this.fishErraticTimer = 0;

    this.currentControl = control;
    this.currentResilience = resilience;
  }

  rollFish() {
    // Gigit Masalah: ikan dibuat langka.
    // Sungai lebih sering memberikan barang nyangkut / sampah.
    const bait = storage.state.equippedBait;

    const lootTable = [
      { type: 'junk', id: 'kayu', name: 'Ranting Nyasar dari Hutan', symbol: '🪵', chance: 26, price: 2, xpReward: 1 },
      { type: 'junk', id: 'batu', name: 'Batu yang Ngaku-ngaku Ikan', symbol: '🪨', chance: 20, price: 1, xpReward: 1 },
      { type: 'junk', id: 'botol', name: 'Botol Healing 2015', symbol: '🧴', chance: 14, price: 3, xpReward: 1 },
      { type: 'junk', id: 'sendal', name: 'Sendal Jepit Perantau', symbol: '🩴', chance: 11, price: 5, xpReward: 2 },
      { type: 'junk', id: 'kaleng', name: 'Kaleng Soda Purba', symbol: '🥫', chance: 8, price: 4, xpReward: 2 },
      { type: 'junk', id: 'ban', name: 'Ban Bekas Tersesat', symbol: '🛞', chance: 6, price: 6, xpReward: 2 },
      { type: 'junk', id: 'topi', name: 'Topi Nelayan Hilang Ingatan', symbol: '👒', chance: 5, price: 8, xpReward: 3 },
      { type: 'fish', rarity: 'Common', chance: 8 },
      { type: 'fish', rarity: 'Rare', chance: 2.8 },
      { type: 'fish', rarity: 'Epic', chance: 0.15 },
      { type: 'fish', rarity: 'Legendary', chance: 0.04 },
      { type: 'fish', rarity: 'Mythic', chance: 0.01 }
    ];

    // Bait can improve the chance of fish without making fish common.
    const fishBoost = bait === 'glowing' ? 1.5 : bait === 'golden' ? 2.2 : bait === 'magnet' ? 3.0 : 1;

    // Fishing from the boat out on open water gives rarer fish an extra,
    // escalating chance boost — this is what gives the boat an actual
    // gameplay reason to exist, not just a way to get around.
    const onBoat = !!(this.env && this.env.playerOnBoat);
    const BOAT_RARITY_BOOST = { Common: 1.0, Rare: 1.3, Epic: 1.7, Legendary: 2.1, Mythic: 2.6 };

    const weighted = lootTable.map(item => {
      if (item.type !== 'fish') return { ...item, weight: item.chance };
      const rarityBoost = onBoat ? (BOAT_RARITY_BOOST[item.rarity] || 1) : 1;
      return { ...item, weight: item.chance * fishBoost * rarityBoost };
    });

    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    let selected = weighted[0];

    for (const item of weighted) {
      if (roll < item.weight) {
        selected = item;
        break;
      }
      roll -= item.weight;
    }

    if (selected.type === 'junk') {
      return {
        id: selected.id,
        name: selected.name,
        rarity: 'Junk',
        rarityColor: '#94a3b8',
        minWeight: 0.1,
        maxWeight: 2.5,
        weight: parseFloat((0.2 + Math.random() * 2.3).toFixed(1)),
        basePrice: selected.price,
        price: selected.price,
        xpReward: selected.xpReward,
        desc: 'Barang nyangkut yang ikut terseret dari sungai.',
        symbol: selected.symbol,
        isJunk: true,
        colors: [0x64748b, 0x475569, 0x94a3b8]
      };
    }

    const isNight = !!(this.env && this.env.isNight);
    const rarityPool = FISH_SPECIES.filter(f => f.rarity === selected.rarity);
    const weightedPool = rarityPool.map(f => ({
      species: f,
      weight: f.nocturnal ? (isNight ? 3.0 : 0.35) : (isNight ? 0.7 : 1.0)
    }));
    const poolTotal = weightedPool.reduce((sum, w) => sum + w.weight, 0);
    let poolRoll = Math.random() * poolTotal;
    let species = weightedPool[0]?.species || FISH_SPECIES[0];
    for (const w of weightedPool) {
      if (poolRoll < w.weight) { species = w.species; break; }
      poolRoll -= w.weight;
    }

    const weight = parseFloat(
      (species.minWeight + Math.random() * (species.maxWeight - species.minWeight)).toFixed(1)
    );
    const price = Math.round(species.basePrice * (weight / species.minWeight));

    return {
      ...species,
      weight,
      price,
      isJunk: false
    };
  }

  toggleAutoCast() {
    this.autoCastEnabled = !this.autoCastEnabled;
    return this.autoCastEnabled;
  }

  update(delta) {
    // Auto cast logic
    if (this.autoCastEnabled && this.state === GAME_STATE.IDLE) {
      const baitLeft = storage.state.baits[storage.state.equippedBait] || 0;

      if (baitLeft <= 0) {
        // Don't keep retrying startAiming() every second — that spammed
        // the same "out of bait" alert forever. Turn auto-cast off once
        // and tell the player clearly instead.
        this.autoCastEnabled = false;
        this.ui.setAutoCastButtonState?.(false);
        this.ui.showAlert('UMPAN HABIS! Auto-Cast dimatikan.', '⚠️');
      } else {
        this.autoCastDelay += delta;
        if (this.autoCastDelay >= 1.0) {
          this.autoCastDelay = 0;
          this.startAiming();
          // Auto release at random power (60-90%)
          setTimeout(() => {
            if (this.state === GAME_STATE.AIMING) {
              this.castPower = 60 + Math.random() * 30;
              this.releaseCast();
            }
          }, 200 + Math.random() * 300);
        }
      }
    }

    if (this.state === GAME_STATE.AIMING) {
      this.castPower += this.castPowerDirection * 100 * delta;
      if (this.castPower >= 100) {
        this.castPower = 100;
        this.castPowerDirection = -1;
      } else if (this.castPower <= 0) {
        this.castPower = 0;
        this.castPowerDirection = 1;
      }
      this.ui.updateCastPower(this.castPower);
    }

    else if (this.state === GAME_STATE.CASTING) {
      this.castProgress += delta * 2.0;
      if (this.castProgress >= 1.0) {
        this.castProgress = 1.0;
        this.env.bobber.position.copy(this.targetBobberPos);
        this.onBobberLanded();
      } else {
        const p = this.castProgress;
        this.env.bobber.position.lerpVectors(this.castStartPos, this.targetBobberPos, p);
        this.env.bobber.position.y += Math.sin(p * Math.PI) * 4.0;
        this.env.updateFishingLine(this.env.bobber.position);
      }
    }

    else if (this.state === GAME_STATE.SHAKING) {
      // Just waiting for player to shake
      // Button click handled by onShakeClick()
    }

    else if (this.state === GAME_STATE.WAITING) {
      this.waitTimer -= delta;

      if (this.env.fishShadow.visible) {
        this.env.fishShadow.position.lerp(this.targetBobberPos, delta * 1.5);
      }

      if (this.waitTimer <= 0) {
        this.triggerBite();
      }
    }

    else if (this.state === GAME_STATE.BITING) {
      this.biteTimer -= delta;
      if (this.biteTimer <= 0) {
        this.resetToIdle('Ikan lepas!');
      }
    }

    else if (this.state === GAME_STATE.REELING) {
      this.updateReelingMinigame(delta);
    }
  }

  updateReelingMinigame(delta) {
    this.fishErraticTimer += delta;

    // Fish movement: readable on the first rod, increasingly erratic for rare fish.
    const changeInterval = Math.max(0.75, 1.65 / this.fishDifficulty);
    if (this.fishErraticTimer >= changeInterval) {
      this.fishErraticTimer = 0;
      this.targetZoneVel *= -1;

      if (this.fishDifficulty >= 2.0 && Math.random() < 0.18) {
        this.targetZonePos += (Math.random() - 0.5) * 14;
      }
    }

    this.targetZonePos += this.targetZoneVel;
    if (this.targetZonePos < 5) {
      this.targetZonePos = 5;
      this.targetZoneVel = Math.abs(this.targetZoneVel);
    } else if (this.targetZonePos > 78) {
      this.targetZonePos = 78;
      this.targetZoneVel = -Math.abs(this.targetZoneVel);
    }

    // Hold TARIK to move the player bar upward.
    const isPressing = this.ui.isReelInputActive();
    if (isPressing) {
      this.playerBarVel += 125 * delta;
      if (Math.random() < 0.16) audio.playReelTick();
    } else {
      this.playerBarVel -= 95 * delta;
    }

    this.playerBarVel *= 0.90;
    this.playerBarPos += this.playerBarVel * delta;
    this.playerBarPos = Math.max(0, Math.min(85, this.playerBarPos));

    // Larger zone for the wooden rod; rarer fish gradually tighten the zone.
    const targetHeight = Math.max(16, 23 - (this.fishDifficulty - 1) * 2.2);
    const playerCenter = this.playerBarPos + 4;
    const zoneCenter = this.targetZonePos + targetHeight / 2;
    const distance = Math.abs(playerCenter - zoneCenter);
    const isInside = distance <= targetHeight * 0.52;

    if (isInside) {
      // Good positioning rewards the player.
      const progressSpeed = 25 + (this.currentControl / 6);
      this.reelProgress = Math.min(100, this.reelProgress + progressSpeed * delta);

      // Tension falls, but never becomes completely free.
      const tensionDecay = 18 + (this.currentResilience / 5);
      this.reelTension = Math.max(0, this.reelTension - tensionDecay * delta);
    } else {
      // Missing the zone costs progress and builds real tension.
      this.reelProgress = Math.max(0, this.reelProgress - 8 * delta);

      const tensionRate =
        (24 + this.fishDifficulty * 12) *
        (100 / (this.currentResilience + 55));

      this.reelTension = Math.min(100, this.reelTension + tensionRate * delta);

      if (this.reelTension > 70) {
        this.ui.showTensionWarning();
      }
    }

    this.ui.updateReelHUD(
      this.playerBarPos,
      this.targetZonePos,
      this.reelProgress,
      this.reelTension,
      targetHeight
    );

    if (this.reelProgress >= 100) {
      this.onFishCaught();
    } else if (this.reelTension >= 100) {
      audio.playLineBreak();
      this.ui.showLineBreakEffect();
      this.resetToIdle('💔 TALI PANCING PUTUS! Ikan kabur!');
    }
  }

  onFishCaught() {
    this.state = GAME_STATE.CAUGHT;
    audio.playCatchFanfare();
    this.ui.hideReelingMinigame();

    // Special friend challenge: catching either Mythic species is a big deal.
    this.caughtFish.isChallengeWin =
      this.caughtFish.id === 'leviathan' || this.caughtFish.id === 'cosmic_dragon';

    // Perfect cast bonus
    let xpBonus = 0;
    let coinBonus = 0;
    
    if (this.castQuality === 'PERFECT!') {
      xpBonus = Math.round(this.caughtFish.xpReward * 0.5);
      coinBonus = 10;
      this.caughtFish.xpReward += xpBonus;
      this.caughtFish.price += coinBonus;
      this.caughtFish.isPerfectCatch = true;
    }

    const leveledUp = storage.addXp(this.caughtFish.xpReward);

    // Junk is loot, not a Fishdex entry.
    if (!this.caughtFish.isJunk && this.caughtFish.id) {
      storage.recordFishCatch(this.caughtFish.id, this.caughtFish.weight);
      // Refresh the in-memory state immediately so Fishdex sees the new entry.
      storage.state = storage.load();
    } else if (this.caughtFish.isJunk) {
      storage.recordJunkCatch();
    }

    // Every catch (fish or junk) goes straight into the inventory bag.
    storage.addToInventory(this.caughtFish);

    // Daily mission progress
    storage.ensureDailyMission();
    if (this.caughtFish.isJunk) {
      storage.progressDailyMission('catch_junk', 1);
    } else {
      storage.progressDailyMission('catch_any', 1);
      if (['Rare', 'Epic', 'Legendary', 'Mythic'].includes(this.caughtFish.rarity)) {
        storage.progressDailyMission('catch_rare', 1);
      }
    }

    // Achievements
    const newlyUnlocked = storage.checkAchievements();

    this.ui.updateHUD();

    if (leveledUp) {
      this.ui.showAlert(`LEVEL UP! SEKARANG LEVEL ${storage.state.level}! 🎉`, '⭐');
    }
    newlyUnlocked.forEach(def => {
      this.ui.showAlert(`Achievement: ${def.name}! ${def.icon}`, '🏅');
    });

    this.ui.showCatchModal(this.caughtFish);
  }

  resetToIdle(alertMessage = null) {
    this.state = GAME_STATE.IDLE;
    this.env.bobber.visible = false;
    this.env.fishShadow.visible = false;
    this.ui.hideBiteAlert();
    this.ui.hideReelingMinigame();
    this.ui.onAimingEnd();
    this.ui.hideShakeButton();

    if (alertMessage) {
      this.ui.showAlert(alertMessage, '❌');
      this.ui.flashDamage();
    }
    
    // Continue auto cast if enabled
    if (this.autoCastEnabled) {
      this.autoCastDelay = 2.0; // Wait 2 seconds before next cast
    }
  }
}
