/* ==========================================================
   Gigit Masalah – Player Controller
   Movement, collision, camera orbit, limb animation
   ========================================================== */

import * as THREE from 'three';
import { audio } from './audio.js';
import { t } from './i18n.js';

export class PlayerController {
  constructor(env) {
    this.env    = env;
    this.player = env.player;
    this.camera = env.camera;

    this.speed         = 8.5;
    this.rotationSpeed = 12.0;

    this.camDistance = 10.5;
    this.camHeight   = 5.0;
    this.camAngleY   = 0;
    this.camAngleX   = 0.25;
    this.sensitivity = 1.0; // multiplier applied to camera look input

    this.keys = { w:false, a:false, s:false, d:false, space:false };
    this.joystickInput = { x:0, y:0 };

    this.velocityY  = 0;
    this.gravity    = -24;
    this.isGrounded = true;

    this.walkCycle = 0;
    this.isMoving  = false;

    this.isMouseDown = false;
    this.prevMouseX  = 0;
    this.prevMouseY  = 0;

    /* ── Boat mode ──────────────────────────────────────── */
    this.boat        = env.boat;
    this.isOnBoat     = false;
    this.boardDistance = 3.0;
    this.disembarkMaxDistance = 4.0; // must be near shore/dock to get off
    this.boatSpeed     = 0;      // current forward speed (with inertia)
    this.boatMaxSpeed  = 9;
    this.boatAccel     = 6;
    this.boatDrag      = 3.2;
    this.boatTurnSpeed = 1.9;    // rad/sec at full steer

    this.boatPromptBtn   = document.getElementById('btn-boat-interact');
    this.boatPromptLabel = document.getElementById('boat-interact-label');
    this.boatPromptBtn?.addEventListener('click', () => this.handleBoatInteract());
    this.boatBonusBadge  = document.getElementById('boat-bonus-badge');

    this.setupInputListeners();
  }

  setupInputListeners() {
    window.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('keyup',   e => this.onKeyUp(e));

    // If the window loses focus while a key is held (alt-tab, switching
    // apps on mobile, etc), the browser won't deliver the matching keyup
    // event — without this, the character would keep walking/jumping
    // forever after the player comes back.
    window.addEventListener('blur', () => {
      this.keys.w = this.keys.a = this.keys.s = this.keys.d = this.keys.space = false;
      this.isMouseDown = false;
      this.joystickInput.x = 0;
      this.joystickInput.y = 0;
    });

    const c = document.getElementById('canvas-container');

    c.addEventListener('mousedown', e => {
      if (e.button === 0 || e.button === 2) {
        this.isMouseDown = true;
        this.prevMouseX  = e.clientX;
        this.prevMouseY  = e.clientY;
      }
    });
    window.addEventListener('mouseup',   () => { this.isMouseDown = false; });
    window.addEventListener('mousemove', e => {
      if (!this.isMouseDown) return;
      this.camAngleY -= (e.clientX - this.prevMouseX) * 0.005 * this.sensitivity;
      this.camAngleX  = THREE.MathUtils.clamp(
        this.camAngleX + (e.clientY - this.prevMouseY) * 0.003 * this.sensitivity, -0.1, 0.8
      );
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });

    c.addEventListener('touchstart', e => {
      if (e.touches.length === 1 &&
          e.touches[0].clientX >= window.innerWidth * 0.5 &&
          !e.target.closest('#ui-overlay button,.modal-box,.fishit-hotbar,#joystick-container')) {
        this.isMouseDown = true;
        this.prevMouseX  = e.touches[0].clientX;
        this.prevMouseY  = e.touches[0].clientY;
      }
    });
    c.addEventListener('touchmove', e => {
      if (!this.isMouseDown || e.touches.length !== 1) return;
      if (e.target.closest('#joystick-container')) return; // joystick finger must never rotate camera
      this.camAngleY -= (e.touches[0].clientX - this.prevMouseX) * 0.006 * this.sensitivity;
      this.camAngleX  = THREE.MathUtils.clamp(
        this.camAngleX + (e.touches[0].clientY - this.prevMouseY) * 0.004 * this.sensitivity, -0.1, 0.8
      );
      this.prevMouseX = e.touches[0].clientX;
      this.prevMouseY = e.touches[0].clientY;
    });
    c.addEventListener('touchend', () => { this.isMouseDown = false; });

    this.setupVirtualJoystick();
  }

  setupVirtualJoystick() {
    const base  = document.getElementById('joystick-base');
    const stick = document.getElementById('joystick-stick');
    if (!base || !stick) return;

    let touchId = null, baseRect = null;

    const update = touch => {
      const cx = baseRect.left + baseRect.width  / 2;
      const cy = baseRect.top  + baseRect.height / 2;
      const r  = baseRect.width / 2;
      let dx = touch.clientX - cx, dy = touch.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > r) { dx = dx/dist*r; dy = dy/dist*r; }
      stick.style.transform = `translate(${dx}px,${dy}px)`;
      this.joystickInput.x = dx / r;
      this.joystickInput.y = dy / r;
    };

    window.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (touchId === null && t.clientX < window.innerWidth * 0.5) {
          touchId = t.identifier;
          baseRect = base.getBoundingClientRect();
          update(t);
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches)
        if (t.identifier === touchId) update(t);
    }, { passive: false });

    window.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          touchId = null;
          stick.style.transform = 'translate(0,0)';
          this.joystickInput.x = this.joystickInput.y = 0;
        }
      }
    }, { passive: false });
  }

  setSensitivity(multiplier) {
    this.sensitivity = multiplier;
  }

  onKeyDown(e) {
    if (e.target.closest('input, textarea')) return;
    if (e.code==='KeyW'||e.code==='ArrowUp')    this.keys.w=true;
    if (e.code==='KeyS'||e.code==='ArrowDown')  this.keys.s=true;
    if (e.code==='KeyA'||e.code==='ArrowLeft')  this.keys.a=true;
    if (e.code==='KeyD'||e.code==='ArrowRight') this.keys.d=true;
    if (e.code==='Space') this.keys.space=true;
  }
  onKeyUp(e) {
    // Always allowed to clear, even if focus happens to be in an input —
    // otherwise a key held down before focusing an input field could get
    // stuck "true" forever, which is the exact class of bug we're fixing.
    if (e.code==='KeyW'||e.code==='ArrowUp')    this.keys.w=false;
    if (e.code==='KeyS'||e.code==='ArrowDown')  this.keys.s=false;
    if (e.code==='KeyA'||e.code==='ArrowLeft')  this.keys.a=false;
    if (e.code==='KeyD'||e.code==='ArrowRight') this.keys.d=false;
    if (e.code==='Space') this.keys.space=false;
  }

  update(delta, canMove = true) {
    this.env.playerOnBoat = this.isOnBoat;

    if (this.isOnBoat) {
      this.updateBoat(delta, canMove);
      this.updateBoatPrompt();
      return;
    }

    let mx = 0, mz = 0;

    if (canMove) {
      if (this.keys.w) mz += 1;
      if (this.keys.s) mz -= 1;
      if (this.keys.a) mx -= 1;
      if (this.keys.d) mx += 1;
      if (Math.abs(this.joystickInput.x) > 0.1) mx += this.joystickInput.x;
      if (Math.abs(this.joystickInput.y) > 0.1) mz -= this.joystickInput.y;
    }

    const len = Math.hypot(mx, mz);
    this.isMoving = len > 0.1;

    if (this.isMoving) {
      const dx = mx / len, dz = mz / len;
      const fwX = Math.sin(this.camAngleY), fwZ = Math.cos(this.camAngleY);
      const rtX = Math.sin(this.camAngleY + Math.PI / 2);
      const rtZ = Math.cos(this.camAngleY + Math.PI / 2);

      const nx = this.player.position.x + (fwX*dz + rtX*dx) * this.speed * delta;
      const nz = this.player.position.z + (fwZ*dz + rtZ*dx) * this.speed * delta;

      const { x, z } = this.clampPosition(nx, nz);
      const moveDX = x - this.player.position.x;
      const moveDZ = z - this.player.position.z;
      this.player.position.x = x;
      this.player.position.z = z;

      if (Math.hypot(moveDX, moveDZ) > 0.001) {
        const target = Math.atan2(moveDX, moveDZ);
        let diff = target - this.player.rotation.y;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        this.player.rotation.y += diff * Math.min(1, this.rotationSpeed * delta);
      }
    }

    // Jump
    if (canMove && this.keys.space && this.isGrounded) {
      this.velocityY  = 8.0;
      this.isGrounded = false;
    }

    // Gravity
    this.velocityY += this.gravity * delta;
    this.player.position.y += this.velocityY * delta;

    const groundY = this.getGroundY(this.player.position.x, this.player.position.z);
    if (this.player.position.y <= groundY) {
      this.player.position.y = groundY;
      this.velocityY  = 0;
      this.isGrounded = true;
    }

    this.animateLimbs(delta);
    this.updateCamera();
    this.updateBoatPrompt();
  }

  /* ── Collision ─────────────────────────────────────────── */
  clampPosition(x, z) {
    const areas = [
      { minX: -1.3,  maxX: 1.3,   minZ: -2,   maxZ: 24  },  // pier
      { minX: -18,   maxX: 18,    minZ: -22,  maxZ: 2   }   // island
    ];

    for (const a of areas)
      if (x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ)
        return { x, z };

    // Nearest valid point
    let bx = x, bz = z, bd = Infinity;
    for (const a of areas) {
      const cx = THREE.MathUtils.clamp(x, a.minX, a.maxX);
      const cz = THREE.MathUtils.clamp(z, a.minZ, a.maxZ);
      const d  = Math.hypot(cx - x, cz - z);
      if (d < bd) { bd = d; bx = cx; bz = cz; }
    }
    return { x: bx, z: bz };
  }

  getGroundY(x, z) {
    if (z > 2 && z < 24 && x > -1.3 && x < 1.3) return 1.8; // pier deck
    // Gentle island roll
    return 1.8 + Math.sin(x * 0.15) * Math.cos(z * 0.12) * 0.5
               + Math.sin(x * 0.28 + z * 0.2) * 0.3;
  }

  /* ── Boat: sailable-water bounds + solid land/dock collision ──── */
  resolveBoatCollision(nx, nz) {
    const WORLD = { minX: -70, maxX: 70, minZ: -15, maxZ: 130 }; // sailable area

    let blocked = false;
    let x = THREE.MathUtils.clamp(nx, WORLD.minX, WORLD.maxX);
    let z = THREE.MathUtils.clamp(nz, WORLD.minZ, WORLD.maxZ);
    if (x !== nx || z !== nz) blocked = true;

    if (!this.env.isWaterAt(x, z)) {
      // Simple "bump" collision — cancel movement into solid land/dock
      // rather than trying to compute a wall slide.
      blocked = true;
      x = this.boat.position.x;
      z = this.boat.position.z;
    }

    return { x, z, blocked };
  }

  /* ── Boat: boarding / disembarking ─────────────────────────── */
  canBoard() {
    if (this.isOnBoat || !this.boat) return false;
    const dx = this.player.position.x - this.boat.position.x;
    const dz = this.player.position.z - this.boat.position.z;
    return Math.hypot(dx, dz) < this.boardDistance;
  }

  boardBoat() {
    if (!this.canBoard()) return false;
    this.isOnBoat = true;
    this.boatSpeed = 0;
    audio.playButtonClick();
    this.ui?.showAlert('Di laut lepas! Peluang ikan langka naik 🌊', '⛵');
    this.boatBonusBadge?.classList.remove('hidden');
    return true;
  }

  exitBoat() {
    if (!this.isOnBoat || !this.boat) return false;

    const { x, z } = this.clampPosition(this.boat.position.x, this.boat.position.z);
    const distToShore = Math.hypot(this.boat.position.x - x, this.boat.position.z - z);

    if (distToShore > this.disembarkMaxDistance) {
      // Refuse to disembark out in open water — otherwise the boat gets
      // left behind unreachable (the player can only walk on land/pier,
      // never in water), permanently stranding it.
      audio.playButtonClick();
      this.ui?.showAlert('Dekatkan kapal ke dermaga/pantai dulu buat turun!', '⚓');
      return false;
    }

    this.isOnBoat = false;
    this.boatSpeed = 0;
    this.player.position.x = x;
    this.player.position.z = z;
    this.player.position.y = this.getGroundY(x, z);
    this.isGrounded = true;
    this.velocityY = 0;
    audio.playButtonClick();
    this.boatBonusBadge?.classList.add('hidden');
    return true;
  }

  handleBoatInteract() {
    if (this.isOnBoat) this.exitBoat();
    else this.boardBoat();
    this.updateBoatPrompt();
  }

  updateBoatPrompt() {
    if (!this.boatPromptBtn) return;
    if (this.isOnBoat) {
      this.boatPromptBtn.classList.remove('hidden');
      this.boatPromptLabel.textContent = t('boat_exit');
    } else if (this.canBoard()) {
      this.boatPromptBtn.classList.remove('hidden');
      this.boatPromptLabel.textContent = t('boat_board');
    } else {
      this.boatPromptBtn.classList.add('hidden');
    }
  }

  /* ── Boat driving physics — arcade-style throttle + turn, with
     inertia/drag so it feels like a boat instead of a character ──── */
  updateBoat(delta, canMove) {
    let throttle = 0, steer = 0;
    if (canMove) {
      if (this.keys.w) throttle += 1;
      if (this.keys.s) throttle -= 1;
      if (this.keys.a) steer += 1;
      if (this.keys.d) steer -= 1;
      if (Math.abs(this.joystickInput.y) > 0.1) throttle -= this.joystickInput.y;
      if (Math.abs(this.joystickInput.x) > 0.1) steer -= this.joystickInput.x;
    }

    // Accelerate toward target speed, or drag back to zero with no input
    const targetSpeed = throttle * this.boatMaxSpeed;
    if (throttle !== 0) {
      const diff = targetSpeed - this.boatSpeed;
      const step = this.boatAccel * delta;
      this.boatSpeed += Math.abs(diff) < step ? diff : Math.sign(diff) * step;
    } else {
      const dragAmt = this.boatDrag * delta;
      this.boatSpeed = Math.abs(this.boatSpeed) < dragAmt ? 0 : this.boatSpeed - Math.sign(this.boatSpeed) * dragAmt;
    }

    // Turning — full rate while cruising, gentler pivot near-stationary
    if (steer !== 0) {
      const turnFactor = Math.abs(this.boatSpeed) > 0.3 ? 1 : 0.4;
      this.boat.rotation.y += steer * this.boatTurnSpeed * turnFactor * delta;
    }

    const dirX = Math.sin(this.boat.rotation.y);
    const dirZ = Math.cos(this.boat.rotation.y);
    const nx = this.boat.position.x + dirX * this.boatSpeed * delta;
    const nz = this.boat.position.z + dirZ * this.boatSpeed * delta;

    const resolved = this.resolveBoatCollision(nx, nz);
    this.boat.position.x = resolved.x;
    this.boat.position.z = resolved.z;
    if (resolved.blocked) this.boatSpeed *= 0.3; // bump off land/dock edges

    // Keep the character glued to the boat's deck — this means camera,
    // rod-tip, and casting logic (which all read this.player) keep
    // working completely unchanged while driving.
    this.player.position.x = this.boat.position.x;
    this.player.position.z = this.boat.position.z;
    this.player.position.y = this.boat.position.y + 0.55;
    this.player.rotation.y = this.boat.rotation.y;

    this.updateCamera();
  }

  /* ── Limb animation (voxel model) ─────────────────────── */
  animateLimbs(delta) {
    const u = this.player.userData;
    if (!u || !u.leftLeg) return;

    if (this.isMoving && this.isGrounded) {
      this.walkCycle += delta * 12;
      const a = Math.sin(this.walkCycle) * 0.7;
      u.leftLeg.rotation.x  =  a;
      u.rightLeg.rotation.x = -a;
      u.leftArm.rotation.x  = -a;
      u.rightArm.rotation.x =  a * 0.4;
    } else {
      this.walkCycle = 0;
      u.leftLeg.rotation.x  *= 0.8;
      u.rightLeg.rotation.x *= 0.8;
      u.leftArm.rotation.x  *= 0.8;
      u.rightArm.rotation.x *= 0.8;
    }
  }

  /* ── Camera orbit ─────────────────────────────────────── */
  updateCamera() {
    const cosX = Math.cos(this.camAngleX);
    const sinX = Math.sin(this.camAngleX);
    const sinY = Math.sin(this.camAngleY);
    const cosY = Math.cos(this.camAngleY);

    const tx = this.player.position.x - this.camDistance * sinY * cosX;
    const ty = this.player.position.y + this.camHeight   + this.camDistance * sinX;
    const tz = this.player.position.z - this.camDistance * cosY * cosX;

    this.camera.position.lerp(new THREE.Vector3(tx, ty, tz), 0.2);
    this.camera.lookAt(
      this.player.position.x,
      this.player.position.y + 2.0,
      this.player.position.z
    );
  }
}
