/* ==========================================================
   Gigit Masalah (Fish It Style) - LocalStorage Save System
   Tracks Coins, Level, XP, Rods, Baits, and Fishdex
   ========================================================== */

const STORAGE_KEY = 'GIGIT_MASALAH_SAVE_V3';

/* -------- Achievement definitions -------- */
export const ACHIEVEMENT_DEFS = [
  { id: 'fishdex_25', name: 'Kolektor Pemula', desc: 'Lengkapi 25% Fishdex', icon: '🥉',
    check: (s) => Object.keys(s.fishdex).length >= 4 },
  { id: 'fishdex_50', name: 'Kolektor Handal', desc: 'Lengkapi 50% Fishdex', icon: '🥈',
    check: (s) => Object.keys(s.fishdex).length >= 8 },
  { id: 'fishdex_100', name: 'Master Fishdex', desc: 'Lengkapi semua 15 spesies ikan', icon: '🥇',
    check: (s) => Object.keys(s.fishdex).length >= 15 },
  { id: 'junk_100', name: 'Raja Sampah', desc: 'Dapatkan barang sampah 100 kali', icon: '🗑️',
    check: (s) => (s.stats.totalJunkCaught || 0) >= 100 },
  { id: 'catch_500', name: 'Pemancing Sejati', desc: 'Total tangkapan 500 kali (ikan + sampah)', icon: '🎣',
    check: (s) => (s.stats.totalCaught || 0) + (s.stats.totalJunkCaught || 0) >= 500 },
  { id: 'mythic_1', name: 'Legenda Hidup', desc: 'Tangkap 1 ikan Mythic', icon: '🐲',
    check: (s) => !!(s.fishdex['leviathan'] || s.fishdex['cosmic_dragon']) },
  { id: 'coins_5000', name: 'Sultan Sungai', desc: 'Kumpulkan total 5000 koin sepanjang waktu', icon: '💰',
    check: (s) => (s.stats.totalCoinsEarned || 0) >= 5000 }
];

/* -------- Daily mission templates -------- */
const MISSION_TEMPLATES = [
  { type: 'catch_any',  label: (t) => `Tangkap ${t} ikan (jenis apa saja)`, target: 5, reward: 40 },
  { type: 'catch_rare', label: (t) => `Tangkap ${t} ikan Rare ke atas`, target: 3, reward: 60 },
  { type: 'catch_junk', label: (t) => `Dapatkan ${t} barang sampah`, target: 6, reward: 30 },
  { type: 'sell_fish',  label: (t) => `Jual hasil tangkapan ${t} kali`, target: 4, reward: 45 }
];

const DEFAULT_STATE = {
  coins: 100,
  level: 1,
  xp: 0,
  maxXp: 100,
  equippedRod: 'rod_wooden',
  unlockedRods: ['rod_wooden'],
  equippedBait: 'worm',
  baits: {
    worm: 20,
    glowing: 5,
    golden: 0,
    magnet: 0
  },
  fishdex: {},
  inventory: {},
  achievements: {},
  dailyMission: null,
  stats: {
    totalCaught: 0,
    totalJunkCaught: 0,
    totalCoinsEarned: 0
  },
  soundEnabled: true,
  graphicsQuality: 'high',
  cameraSensitivity: 'sedang', // 'rendah' | 'sedang' | 'tinggi'
  tutorialSeen: false,
  introDialogSeen: false,
  language: 'id', // 'id' | 'en'
  playerName: null,
  playerAvatar: null
};

export class StorageManager {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          fishdex: (parsed && parsed.fishdex && typeof parsed.fishdex === 'object')
            ? parsed.fishdex
            : {},
          inventory: (parsed && parsed.inventory && typeof parsed.inventory === 'object')
            ? parsed.inventory
            : {},
          achievements: (parsed && parsed.achievements && typeof parsed.achievements === 'object')
            ? parsed.achievements
            : {},
          stats: {
            ...DEFAULT_STATE.stats,
            ...(parsed && parsed.stats ? parsed.stats : {})
          }
        };
      }
    } catch (e) {
      console.warn('Failed to load save state, resetting:', e);
    }
    return { ...DEFAULT_STATE };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  addCoins(amount) {
    this.state.coins += amount;
    if (amount > 0) {
      this.state.stats.totalCoinsEarned += amount;
    }
    this.save();
    return this.state.coins;
  }

  deductCoins(amount) {
    if (this.state.coins >= amount) {
      this.state.coins -= amount;
      this.save();
      return true;
    }
    return false;
  }

  addXp(amount) {
    this.state.xp += amount;
    let leveledUp = false;
    while (this.state.xp >= this.state.maxXp) {
      this.state.xp -= this.state.maxXp;
      this.state.level += 1;
      this.state.maxXp = Math.round(this.state.maxXp * 1.5);
      leveledUp = true;
    }
    this.save();
    return leveledUp;
  }

  unlockRod(rodId) {
    if (!this.state.unlockedRods.includes(rodId)) {
      this.state.unlockedRods.push(rodId);
      this.save();
    }
  }

  equipRod(rodId) {
    if (this.state.unlockedRods.includes(rodId)) {
      this.state.equippedRod = rodId;
      this.save();
    }
  }

  addBait(baitId, count) {
    this.state.baits[baitId] = (this.state.baits[baitId] || 0) + count;
    this.save();
  }

  useBait() {
    const current = this.state.equippedBait;
    if (this.state.baits[current] > 0) {
      this.state.baits[current]--;
      this.save();
      return true;
    }
    return false;
  }

  equipBait(baitId) {
    if (this.state.baits[baitId] !== undefined && this.state.baits[baitId] > 0) {
      this.state.equippedBait = baitId;
      this.save();
      return true;
    }
    return false;
  }

  recordFishCatch(fishId, weight) {
    if (!this.state.fishdex[fishId]) {
      this.state.fishdex[fishId] = { unlocked: true, count: 1, maxWeight: weight };
    } else {
      const entry = this.state.fishdex[fishId];
      entry.unlocked = true;
      entry.count += 1;
      if (weight > entry.maxWeight) {
        entry.maxWeight = weight;
      }
    }
    this.state.stats.totalCaught += 1;
    this.save();
  }

  recordJunkCatch() {
    this.state.stats.totalJunkCaught = (this.state.stats.totalJunkCaught || 0) + 1;
    this.save();
  }

  /* -------- Daily mission -------- */
  getTodayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  ensureDailyMission() {
    const today = this.getTodayDateString();
    if (!this.state.dailyMission || this.state.dailyMission.date !== today) {
      const tpl = MISSION_TEMPLATES[Math.floor(Math.random() * MISSION_TEMPLATES.length)];
      this.state.dailyMission = {
        date: today,
        type: tpl.type,
        label: tpl.label(tpl.target),
        target: tpl.target,
        progress: 0,
        reward: tpl.reward,
        claimed: false
      };
      this.save();
    }
    return this.state.dailyMission;
  }

  progressDailyMission(type, amount = 1) {
    const m = this.state.dailyMission;
    if (!m || m.claimed || m.type !== type) return;
    m.progress = Math.min(m.target, m.progress + amount);
    this.save();
  }

  claimDailyMission() {
    const m = this.state.dailyMission;
    if (!m || m.claimed || m.progress < m.target) return false;
    m.claimed = true;
    this.addCoins(m.reward);
    this.save();
    return true;
  }

  /* -------- Achievements -------- */
  checkAchievements() {
    const newlyUnlocked = [];
    ACHIEVEMENT_DEFS.forEach(def => {
      if (!this.state.achievements[def.id] && def.check(this.state)) {
        this.state.achievements[def.id] = true;
        newlyUnlocked.push(def);
      }
    });
    if (newlyUnlocked.length) this.save();
    return newlyUnlocked;
  }

  resetProgress() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to reset progress:', e);
    }
  }

  setProfile(name, avatarDataUrl) {
    this.state.playerName = (name || '').trim().slice(0, 16) || 'Pemancing';
    if (avatarDataUrl) this.state.playerAvatar = avatarDataUrl;
    this.save();
  }

  hasProfile() {
    return !!this.state.playerName;
  }

  setGraphicsQuality(quality) {
    this.state.graphicsQuality = quality === 'low' ? 'low' : 'high';
    this.save();
    return this.state.graphicsQuality;
  }

  addToInventory(item) {
    const key = item.id;
    if (!key) return;
    const existing = this.state.inventory[key];
    if (existing) {
      existing.count += 1;
      existing.lastWeight = item.weight;
    } else {
      this.state.inventory[key] = {
        id: item.id,
        name: item.name,
        symbol: item.symbol,
        rarity: item.rarity,
        rarityColor: item.rarityColor,
        price: item.price,
        desc: item.desc,
        isJunk: !!item.isJunk,
        count: 1,
        lastWeight: item.weight
      };
    }
    this.save();
  }

  removeFromInventory(itemId, qty = 1) {
    const entry = this.state.inventory[itemId];
    if (!entry) return false;
    entry.count -= qty;
    if (entry.count <= 0) delete this.state.inventory[itemId];
    this.save();
    return true;
  }

  toggleSound() {
    this.state.soundEnabled = !this.state.soundEnabled;
    this.save();
    return this.state.soundEnabled;
  }

  setCameraSensitivity(level) {
    this.state.cameraSensitivity = ['rendah', 'sedang', 'tinggi'].includes(level) ? level : 'sedang';
    this.save();
    return this.state.cameraSensitivity;
  }

  hasSeenTutorial() {
    return !!this.state.tutorialSeen;
  }

  markTutorialSeen() {
    this.state.tutorialSeen = true;
    this.save();
  }

  hasSeenIntroDialog() {
    return !!this.state.introDialogSeen;
  }

  markIntroDialogSeen() {
    this.state.introDialogSeen = true;
    this.save();
  }

  setLanguage(lang) {
    this.state.language = lang === 'en' ? 'en' : 'id';
    this.save();
    return this.state.language;
  }
}

export const storage = new StorageManager();
