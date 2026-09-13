/* ==========================================================
   Gigit Masalah – Environment (LOW-POLY STYLIZED ISLAND WORLD)
   Replaces the old voxel/blocky world with a faceted, flat-shaded
   tropical look (gradient sky, faceted hills, floating-island feel).
   Public API is identical to the old environment.js, so nothing
   else in the project needs to change.
   ========================================================== */

import * as THREE from 'three';
import {
  createVoxelPlayer,
  createVoxelRod,
  createVoxelBobber,
  createVoxelPier,
  createVoxelTree,
  createVoxelBoat,
  createNPCFisherman
} from './voxelModels.js';
import { tryLoadCustomModelFor } from './modelLoader.js';
import { audio } from './audio.js';
import { storage } from './storage.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* -------- Palette (Low-Poly Stylized Islands) -------- */
const PALETTE = {
  skyTop:    0x4fc3e8,
  skyBottom: 0xfde68a,
  fog:       0x8fd6e8,
  seaDeep:   0x0b4f6c,
  seaShallow:0x4fd1c5,
  sand:      0xf4d9a0,
  grass:     0x6bbf59,
  grassDark: 0x4f9c46,
  rock:      0x8d8f99,
  cliff:     0x6b5842
};

/* -------- Day / Night cycle palettes -------- */
const DAY_SKY_TOP    = new THREE.Color(0x4fc3e8);
const DAY_SKY_BOTTOM = new THREE.Color(0xfde68a);
const NIGHT_SKY_TOP    = new THREE.Color(0x060b1f);
const NIGHT_SKY_BOTTOM = new THREE.Color(0x1c2951);
const DAY_FOG   = new THREE.Color(PALETTE.fog);
const NIGHT_FOG = new THREE.Color(0x0d1730);

export class GameEnvironment {
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0075);

    this.camera = new THREE.PerspectiveCamera(
      45, window.innerWidth / window.innerHeight, 0.1, 1000
    );

    const isLowGraphics = storage.state.graphicsQuality === 'low';

    this.renderer = new THREE.WebGLRenderer({ antialias: !isLowGraphics, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowGraphics ? 1 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = !isLowGraphics;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    this.isLowGraphics = isLowGraphics;

    // Bloom post-processing — makes emissive/bright things (pier lanterns
    // at night, glowing Mythic fish, the cosmic rod) softly "bleed" light
    // instead of being flat colors. Only actually used on High graphics;
    // Low graphics renders straight to screen to stay fast on weak devices.
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, // strength
      0.4,  // radius
      0.85  // luminance threshold — only genuinely bright/emissive spots bloom
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    // Day/night cycle state — a full loop takes dayCycleDuration seconds.
    // Starts partway into "day" so the world looks normal immediately.
    this.dayCycleDuration = 240;
    this.dayTime = this.dayCycleDuration * 0.3;
    this.dayFactor = 1; // 1 = full day, 0 = full night
    this.isNight = false;

    this.setupSky();
    this.setupStars();
    this.setupLighting();
    this.setupWater();
    this.setupPierAndPlayer();
    this.setupIslandScenery();
    this.setupReef();
    this.setupPierLanterns();
    this.setupBirds();
    this.setupJumpingFish();
    this.setupBoat();
    this.setupNPC();
    this.setupFishingLine();
    this.setupParticles();
    this.setupSplashRing();
    this.setupRain();

    // Weather cycles randomly between clear and rainy stretches
    this.isRaining = false;
    this.weatherTimer = 0;
    this.nextWeatherCheck = 20;

    // Frame counter used to throttle the water ripple recompute on Low
    // graphics — the sine loop touches ~2600 vertices every frame
    // regardless of quality setting, which is one of the biggest CPU
    // costs on low-end phones.
    this._waterFrameCounter = 0;

    window.addEventListener('resize', () => this.onWindowResize());
  }

  /* ── Simple starfield, fades in at night ─────────────────── */
  setupStars() {
    const starCount = 220;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.48;
      const r = 380;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.4, transparent: true, opacity: 0, sizeAttenuation: false
    }));
    this.scene.add(this.stars);
  }

  /* ── Gradient sky dome (sunset -> blue) ─────────────────── */
  setupSky() {
    const skyGeo = new THREE.SphereGeometry(400, 24, 12);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:    { value: new THREE.Color(PALETTE.skyTop) },
        bottomColor: { value: new THREE.Color(PALETTE.skyBottom) },
        offset:      { value: 15 },
        exponent:    { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
  }

  setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xfff2d6, 0x2f6b4a, 0.9);
    this.scene.add(this.hemiLight);

    this.sun = new THREE.DirectionalLight(0xfff2cf, 1.5);
    this.sun.position.set(30, 45, -20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far  = 140;
    this.sun.shadow.camera.left = -40;
    this.sun.shadow.camera.right = 40;
    this.sun.shadow.camera.top   = 40;
    this.sun.shadow.camera.bottom = -40;
    this.sun.shadow.bias = -0.0001;
    this.scene.add(this.sun);
  }

  setupWater() {
    const geo = new THREE.PlaneGeometry(160, 160, 50, 50);
    geo.rotateX(-Math.PI / 2);

    this.waterMat = new THREE.MeshStandardMaterial({
      color: PALETTE.seaShallow,
      roughness: 0.08,
      metalness: 0.25,
      transparent: true,
      opacity: 0.9,
      flatShading: true
    });

    this.water = new THREE.Mesh(geo, this.waterMat);
    this.water.position.set(0, 0, 30);
    this.water.receiveShadow = true;
    this.scene.add(this.water);

    this.waterPositions = geo.attributes.position.array;
    this.waterOriginalY = new Float32Array(this.waterPositions.length / 3);
    for (let i = 0; i < this.waterOriginalY.length; i++)
      this.waterOriginalY[i] = this.waterPositions[i * 3 + 1];

    // Deep-sea floor beneath, for color depth in the distance
    const deep = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ color: PALETTE.seaDeep, roughness: 1, flatShading: true })
    );
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(0, -3, 30);
    this.scene.add(deep);
  }

  setupPierAndPlayer() {
    this.pier = createVoxelPier();
    this.pier.position.set(0, 1.6, 0);
    this.scene.add(this.pier);

    this.player = createVoxelPlayer();
    this.player.position.set(0, 1.8, 4.0);
    this.player.rotation.y = Math.PI / 2; // face sideways off the dock, toward open water
    this.scene.add(this.player);

    this.currentRodType = 'rod_wooden';
    this.rodGroup = new THREE.Group();
    this.updateRodModel(this.currentRodType);
    this.player.userData.rightArm.add(this.rodGroup);
    this.rodGroup.position.set(0.1, 1.2, 0.4);
    this.rodGroup.rotation.x = -Math.PI / 6;

    this.bobber = createVoxelBobber();
    this.bobber.visible = false;
    this.bobberTargetY = 0;
    this.scene.add(this.bobber);

    const sGeo = new THREE.PlaneGeometry(1.4, 0.7);
    sGeo.rotateX(-Math.PI / 2);
    this.fishShadow = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({
      color: 0x0b4f6c, transparent: true, opacity: 0.6
    }));
    this.fishShadow.position.set(0, 0.05, 0);
    this.fishShadow.visible = false;
    this.scene.add(this.fishShadow);
  }

  async updateRodModel(rodType) {
    this.currentRodType = rodType;
    while (this.rodGroup.children.length)
      this.rodGroup.remove(this.rodGroup.children[0]);

    const custom = await tryLoadCustomModelFor(rodType);
    if (custom) {
      // Normalize an arbitrary custom model to a sensible "held rod" size,
      // then anchor its lowest point at the grip origin so it extends
      // outward like the procedural rod does.
      const box = new THREE.Box3().setFromObject(custom);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scaleFactor = 2.2 / maxDim;
      custom.scale.multiplyScalar(scaleFactor);

      const scaledBox = new THREE.Box3().setFromObject(custom);
      custom.position.set(-scaledBox.min.x, -scaledBox.min.y, -scaledBox.min.z);

      this.rodGroup.add(custom);
    } else {
      this.rodGroup.add(createVoxelRod(rodType));
    }
  }

  /* ── Faceted low-poly island, cliffs, hills, trees, rocks ── */
  setupIslandScenery() {
    // Main island slab (keeps the exact same footprint the player
    // collision system expects: x -18..18, z -22..2)
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(50, 1.2, 50),
      new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.8, flatShading: true })
    );
    ground.position.set(0, 1.0, -12);
    ground.receiveShadow = true;
    ground.castShadow = true;
    this.scene.add(ground);

    // Faceted rock/cliff trim around the island edge for a "floating
    // island" silhouette instead of a flat box edge
    const cliffMat = new THREE.MeshStandardMaterial({ color: PALETTE.cliff, roughness: 0.9, flatShading: true });
    const cliffEdgePositions = [
      [-18, 0.2, -12], [18, 0.2, -12], [0, 0.2, -22],
      [-13, 0.2, -20], [13, 0.2, -20], [-13, 0.2, -3], [13, 0.2, -3]
    ];
    cliffEdgePositions.forEach(([x, y, z]) => {
      const chunk = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + Math.random(), 0), cliffMat);
      chunk.position.set(x, y, z);
      chunk.scale.set(1, 0.7, 1);
      chunk.castShadow = true;
      chunk.receiveShadow = true;
      this.scene.add(chunk);
    });

    // Sandy beach strip near the pier
    const beachMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.9, flatShading: true });
    const beach = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 10), beachMat);
    beach.position.set(0, 1.55, 5);
    beach.receiveShadow = true;
    this.scene.add(beach);

    [[-13, 1.55, -5], [13, 1.55, -5]].forEach(([x, y, z]) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 8), beachMat.clone());
      s.position.set(x, y, z);
      s.receiveShadow = true;
      this.scene.add(s);
    });

    // Background hills — faceted low-poly "gem" mountains
    const hillMat = new THREE.MeshStandardMaterial({ color: PALETTE.grassDark, roughness: 0.85, flatShading: true });
    const hills = [
      [-14, 2.2, -26, 1.8, 1.6, 1.5],
      [ 12, 2.8, -28, 2.0, 1.9, 1.8],
      [  0, 4.0, -34, 2.4, 2.6, 2.0],
      [ -7, 1.5, -20, 1.2, 1.1, 1.2],
      [  8, 1.6, -21, 1.3, 1.2, 1.3]
    ];
    hills.forEach(([x, y, z, sx, sy, sz]) => {
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(6, 0), hillMat.clone());
      h.position.set(x, y, z);
      h.scale.set(sx, sy, sz);
      h.castShadow = true;
      h.receiveShadow = true;
      this.scene.add(h);
    });

    const peakMat = new THREE.MeshStandardMaterial({ color: 0x2f5c4a, roughness: 0.9, flatShading: true });
    const peak = new THREE.Mesh(new THREE.IcosahedronGeometry(8, 0), peakMat);
    peak.position.set(0, 5.5, -40);
    peak.scale.set(2.4, 2.0, 2.0);
    peak.castShadow = true;
    this.scene.add(peak);

    // Trees
    [
      [-13, 1.8, -17], [-8, 1.8, -19], [-15, 1.8, -8],
      [ 13, 1.8, -17], [ 9, 1.8, -21], [ 15, 1.8, -7],
      [ -3, 1.8, -15], [ 4, 1.8, -18]
    ].forEach(([x, y, z]) => {
      const t = createVoxelTree();
      t.position.set(x, y, z);
      t.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.85 + Math.random() * 0.3;
      t.scale.set(s, s, s);
      this.scene.add(t);
    });

    // Rocks
    const rockMat = new THREE.MeshStandardMaterial({ color: PALETTE.rock, roughness: 0.7, flatShading: true });
    [[-6, 2.2, 3], [7, 2.2, 2], [-11, 2.2, 4], [12, 2.2, 5]].forEach(([x, y, z]) => {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), rockMat);
      r.position.set(x, y, z);
      r.rotation.set(Math.random(), Math.random(), Math.random());
      r.castShadow = true;
      this.scene.add(r);
    });

    // Clouds — flattened faceted low-poly puffs, warm sunset tint
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xfff6e6, transparent: true, opacity: 0.92, flatShading: true, roughness: 1
    });
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 3, 0), cloudMat);
      c.scale.set(1.6, 0.5, 1);
      c.position.set(
        (Math.random() - 0.5) * 120,
        24 + Math.random() * 8,
        (Math.random() - 0.5) * 120
      );
      this.clouds.add(c);
    }
    this.scene.add(this.clouds);
  }

  /* ── Small reef clusters scattered in the far water — static,
     no per-frame cost, just makes the sea feel less empty ──────── */
  setupReef() {
    const reefMat = new THREE.MeshStandardMaterial({ color: 0x5c7c85, roughness: 0.85, flatShading: true });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x3f6b52, roughness: 0.9, flatShading: true });
    const reefSpots = [
      [-14, 0.25, 42], [16, 0.2, 48], [-6, 0.3, 55],
      [9, 0.22, 60], [-20, 0.25, 65], [4, 0.25, 70]
    ];
    reefSpots.forEach(([x, y, z]) => {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + Math.random() * 0.7, 0), reefMat);
      rock.position.set(x, y, z);
      rock.scale.set(1, 0.55 + Math.random() * 0.3, 1);
      rock.rotation.y = Math.random() * Math.PI;
      this.scene.add(rock);
      if (Math.random() < 0.6) {
        const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mossMat);
        moss.position.set(x + (Math.random() - 0.5) * 0.6, y + 0.45, z + (Math.random() - 0.5) * 0.6);
        this.scene.add(moss);
      }
    });
  }

  /* ── Lantern posts along the pier — one shared emissive material,
     brightness driven by the day/night cycle in update() ──────── */
  setupPierLanterns() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3f2e1c, roughness: 0.8, flatShading: true });
    this.lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffd28a, emissive: 0xffb347, emissiveIntensity: 0, roughness: 0.4
    });
    [4, 12, 20].forEach(z => {
      [-1.35, 1.35].forEach(x => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6), postMat);
        post.position.set(x, 2.1, z);
        this.scene.add(post);
        const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), this.lanternMat);
        lamp.position.set(x, 2.72, z);
        this.scene.add(lamp);
      });
    });
  }

  /* ── A few birds looping in the sky — cheap (4 meshes), hidden at
     night and on Low graphics to keep things light ──────────────── */
  setupBirds() {
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, flatShading: true, roughness: 0.6 });
    this.birds = [];
    for (let i = 0; i < 4; i++) {
      const bird = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 3), birdMat);
      bird.rotation.x = Math.PI / 2;
      bird.scale.set(1, 1, 0.25);
      bird.userData = {
        radius: 30 + Math.random() * 15,
        height: 20 + Math.random() * 8,
        speed: 0.15 + Math.random() * 0.1,
        offset: Math.random() * Math.PI * 2
      };
      this.scene.add(bird);
      this.birds.push(bird);
    }
  }

  /* ── Occasional fish jumping out of the water in the distance —
     purely decorative, reuses the existing splash effect ─────────── */
  setupJumpingFish() {
    this.jumpFishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, flatShading: true, roughness: 0.4 });
    this.activeJumpFish = null;
    this.fishJumpTimer = 6 + Math.random() * 10;
  }

  triggerFishJump() {
    const x = (Math.random() - 0.5) * 40;
    const z = 14 + Math.random() * 45;
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), this.jumpFishMat);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.activeJumpFish = { mesh, elapsed: 0, duration: 0.9, x, z };
    this.triggerSplash(new THREE.Vector3(x, 0, z));
  }

  /* ── Shared land/water check — used by casting validation and boat
     collision so both agree on exactly the same land footprint.
     Covers the island's walkable core, the pier deck, AND the sandy
     beach strips (which sit outside the island's walkable collision
     box but are still visibly solid sand, not water). ─────────── */
  isWaterAt(x, z) {
    const ISLAND      = { minX: -18, maxX: 18, minZ: -22, maxZ: 2 };
    const PIER        = { minX: -1.6, maxX: 1.6, minZ: -2, maxZ: 24 };
    const BEACH_CENTER = { minX: -4, maxX: 4, minZ: 0, maxZ: 10 };
    const BEACH_LEFT   = { minX: -18, maxX: -8, minZ: -9, maxZ: -1 };
    const BEACH_RIGHT  = { minX: 8, maxX: 18, minZ: -9, maxZ: -1 };
    const inside = (r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
    return !(
      inside(ISLAND) || inside(PIER) ||
      inside(BEACH_CENTER) || inside(BEACH_LEFT) || inside(BEACH_RIGHT)
    );
  }

  /* ── Rideable boat — docked beside the pier at start. Its x/z are
     driven by PlayerController while boarded; here we only handle the
     idle bob/roll so it always looks alive on the water ─────────── */
  setupBoat() {
    this.boat = createVoxelBoat();
    // (2.5, 0, 18) sits just off the side of the pier's far end — clear
    // of the island box (z ≤ 2), the beach slabs (z 0-10), and the pier
    // deck itself (x ±1.6) — genuinely open water, not land.
    this.boat.position.set(2.5, 0, 18);
    this.boat.rotation.y = Math.PI / 2;
    this.scene.add(this.boat);
  }

  /* ── Stationary NPC ("Nelayan Tua") sitting by the dock — placed at
     (-2.5, z=1.5), which sits inside the island's real walkable
     collision box (x:-18..18, z:-22..2). The visible beach sand
     extends further than that box, so anywhere outside it would look
     fine but be physically unreachable on foot. ─────────────────── */
  setupNPC() {
    this.npc = createNPCFisherman();
    const nx = -2.5, nz = 1.5;
    const ny = 1.8 + Math.sin(nx * 0.15) * Math.cos(nz * 0.12) * 0.5
                    + Math.sin(nx * 0.28 + nz * 0.2) * 0.3;
    this.npc.position.set(nx, ny, nz);
    this.npc.rotation.y = Math.PI * 0.85; // facing roughly toward the pier/water
    this.scene.add(this.npc);
  }

  setupFishingLine() {
    const n = 20;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.fishingLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }));
    this.fishingLine.visible = false;
    this.scene.add(this.fishingLine);
  }

  setupParticles() {
    const n = 40;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    this.pVelocities = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] = -100;
      this.pVelocities.push(new THREE.Vector3());
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.splashParticles = new THREE.Points(geo,
      new THREE.PointsMaterial({ color: 0xeafcff, size: 0.35, transparent: true, opacity: 0.9 })
    );
    this.scene.add(this.splashParticles);
  }

  setupSplashRing() {
    const ringGeo = new THREE.RingGeometry(0.15, 0.35, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xeafcff, transparent: true, opacity: 0, side: THREE.DoubleSide
    });
    this.splashRing = new THREE.Mesh(ringGeo, ringMat);
    this.splashRing.rotation.x = -Math.PI / 2;
    this.splashRing.visible = false;
    this.scene.add(this.splashRing);
    this.splashRingActive = false;
    this.splashRingTimer = 0;
  }

  setupRain() {
    const count = 260;
    const positions = new Float32Array(count * 6); // 2 points (top/bottom) per drop
    this.rainVelocities = new Float32Array(count);
    this.rainDropCount = count;

    const spawnDrop = (i, freshTop = false) => {
      const x = (Math.random() - 0.5) * 70;
      const z = (Math.random() - 0.5) * 70 - 5;
      const y = freshTop ? 26 + Math.random() * 10 : Math.random() * 34;
      positions[i * 6]     = x; positions[i * 6 + 1] = y;       positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x; positions[i * 6 + 4] = y - 0.6; positions[i * 6 + 5] = z;
      this.rainVelocities[i] = 14 + Math.random() * 6;
    };
    for (let i = 0; i < count; i++) spawnDrop(i);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xbcd9e6, transparent: true, opacity: 0.5 });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  triggerSplash(pos) {
    const arr = this.splashParticles.geometry.attributes.position.array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3]     = pos.x + (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 1] = pos.y;
      arr[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.4;
      this.pVelocities[i].set(
        (Math.random() - 0.5) * 4,
        2.5 + Math.random() * 4,
        (Math.random() - 0.5) * 4
      );
    }
    this.splashParticles.geometry.attributes.position.needsUpdate = true;

    // Expanding ripple ring on the water surface
    this.splashRing.position.set(pos.x, 0.05, pos.z);
    this.splashRing.scale.set(1, 1, 1);
    this.splashRing.material.opacity = 0.7;
    this.splashRing.visible = true;
    this.splashRingActive = true;
    this.splashRingTimer = 0;
  }

  getRodTipWorldPosition() {
    const tip = new THREE.Vector3(0, 1.8, 2.0);
    this.rodGroup.localToWorld(tip);
    return tip;
  }

  updateFishingLine(bobberPos) {
    if (!this.bobber.visible) { this.fishingLine.visible = false; return; }
    this.fishingLine.visible = true;

    const rod = this.getRodTipWorldPosition();
    const arr = this.fishingLine.geometry.attributes.position.array;
    const n = arr.length / 3;
    const mid = new THREE.Vector3().addVectors(rod, bobberPos).multiplyScalar(0.5);
    mid.y -= 1.5;
    const pts = new THREE.QuadraticBezierCurve3(rod, mid, bobberPos).getPoints(n - 1);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y; arr[i * 3 + 2] = pts[i].z;
    }
    this.fishingLine.geometry.attributes.position.needsUpdate = true;
  }

  update(time, delta) {
    // Day-night cycle
    this.dayTime = (this.dayTime + delta) % this.dayCycleDuration;
    const phase = (this.dayTime / this.dayCycleDuration) * Math.PI * 2;
    this.dayFactor = (Math.sin(phase - Math.PI / 2) + 1) / 2; // 0 = deep night, 1 = full day
    this.isNight = this.dayFactor < 0.35;

    const skyTop = new THREE.Color().lerpColors(NIGHT_SKY_TOP, DAY_SKY_TOP, this.dayFactor);
    const skyBottom = new THREE.Color().lerpColors(NIGHT_SKY_BOTTOM, DAY_SKY_BOTTOM, this.dayFactor);

    this.scene.fog.color.lerpColors(NIGHT_FOG, DAY_FOG, this.dayFactor);
    this.sun.intensity = 0.35 + this.dayFactor * 1.25;
    this.hemiLight.intensity = 0.35 + this.dayFactor * 0.65;

    this.stars.material.opacity = this.isLowGraphics ? 0 : (1 - this.dayFactor) * 0.85;

    // Weather cycling — occasionally starts/stops a rain shower (skipped on low graphics)
    if (!this.isLowGraphics) {
      this.weatherTimer += delta;
      if (this.weatherTimer > this.nextWeatherCheck) {
        this.weatherTimer = 0;
        if (this.isRaining) {
          this.isRaining = Math.random() < 0.35; // chance to keep raining a bit longer
          this.nextWeatherCheck = this.isRaining ? 20 : 45 + Math.random() * 40;
        } else {
          this.isRaining = Math.random() < 0.25;
          this.nextWeatherCheck = this.isRaining ? 25 + Math.random() * 20 : 45 + Math.random() * 45;
        }
        this.rain.visible = this.isRaining;
        audio.setRainActive(this.isRaining);
      }
    }

    if (this.isRaining) {
      skyTop.lerp(new THREE.Color(0x5b6b78), 0.35);
      skyBottom.lerp(new THREE.Color(0x707d85), 0.3);
      this.sun.intensity *= 0.55;
      this.scene.fog.color.lerp(new THREE.Color(0x5b6b78), 0.3);

      const arr = this.rain.geometry.attributes.position.array;
      for (let i = 0; i < this.rainDropCount; i++) {
        const vy = this.rainVelocities[i] * delta;
        arr[i * 6 + 1] -= vy;
        arr[i * 6 + 4] -= vy;
        if (arr[i * 6 + 1] < 0) {
          const x = (Math.random() - 0.5) * 70;
          const z = (Math.random() - 0.5) * 70 - 5;
          const y = 26 + Math.random() * 10;
          arr[i * 6]     = x; arr[i * 6 + 1] = y;       arr[i * 6 + 2] = z;
          arr[i * 6 + 3] = x; arr[i * 6 + 4] = y - 0.6; arr[i * 6 + 5] = z;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    this.sky.material.uniforms.topColor.value.copy(skyTop);
    this.sky.material.uniforms.bottomColor.value.copy(skyBottom);

    // Pier lanterns glow warmer as it gets darker (single shared material)
    if (this.lanternMat) {
      this.lanternMat.emissiveIntensity = THREE.MathUtils.clamp((1 - this.dayFactor) * 1.6, 0, 1.4);
    }

    // Boat idle float — x/z are driven by PlayerController while
    // boarded, this only adds the vertical bob + gentle roll so it
    // always looks like it's sitting on water, docked or driven.
    if (this.boat) {
      this.boat.position.y = Math.sin(time * 1.6 + this.boat.position.x * 0.3) * 0.08;
      this.boat.rotation.z = Math.sin(time * 1.3 + this.boat.position.z * 0.2) * 0.03;
    }

    // Birds — simple circular flight path, resting at night / Low graphics
    if (this.birds) {
      const birdsActive = !this.isNight && !this.isLowGraphics;
      this.birds.forEach(bird => {
        bird.visible = birdsActive;
        if (!birdsActive) return;
        const { radius, height, speed, offset } = bird.userData;
        const t = time * speed + offset;
        bird.position.set(Math.cos(t) * radius, height + Math.sin(t * 2) * 1.5, Math.sin(t) * radius - 10);
        bird.rotation.y = -t + Math.PI / 2;
      });
    }

    // Occasional fish jump out in the water (skipped on Low graphics)
    if (!this.isLowGraphics) {
      this.fishJumpTimer -= delta;
      if (this.fishJumpTimer <= 0 && !this.activeJumpFish) {
        this.triggerFishJump();
        this.fishJumpTimer = 8 + Math.random() * 14;
      }
      if (this.activeJumpFish) {
        const jf = this.activeJumpFish;
        jf.elapsed += delta;
        const p = Math.min(1, jf.elapsed / jf.duration);
        jf.mesh.position.y = Math.sin(p * Math.PI) * 1.6;
        jf.mesh.rotation.x = p * Math.PI * 1.4;
        if (p >= 1) {
          this.scene.remove(jf.mesh);
          jf.mesh.geometry.dispose();
          this.triggerSplash(new THREE.Vector3(jf.x, 0, jf.z));
          this.activeJumpFish = null;
        }
      }
    }

    // Water ripple — full smoothness every frame on High graphics.
    // On Low graphics, only recompute every 3rd frame: the sine-based
    // displacement is subtle enough that this isn't noticeable, but it
    // cuts this loop's CPU cost by ~66% on low-end phones.
    this._waterFrameCounter++;
    const shouldUpdateWater = !this.isLowGraphics || (this._waterFrameCounter % 3 === 0);
    if (shouldUpdateWater) {
      const pos = this.waterPositions;
      for (let i = 0; i < this.waterOriginalY.length; i++) {
        const u = pos[i * 3], v = pos[i * 3 + 2];
        pos[i * 3 + 1] = Math.sin(time * 2.0 + u * 0.4 + v * 0.3) * 0.15;
      }
      this.water.geometry.attributes.position.needsUpdate = true;
    }

    // Clouds drift
    this.clouds.children.forEach(c => {
      c.position.x += delta * 0.8;
      if (c.position.x > 70) c.position.x = -70;
    });

    // Splash particles
    const pp = this.splashParticles.geometry.attributes.position.array;
    for (let i = 0; i < pp.length / 3; i++) {
      if (pp[i * 3 + 1] > -50) {
        pp[i * 3]     += this.pVelocities[i].x * delta;
        pp[i * 3 + 1] += this.pVelocities[i].y * delta;
        pp[i * 3 + 2] += this.pVelocities[i].z * delta;
        this.pVelocities[i].y -= 9.8 * delta;
        if (pp[i * 3 + 1] < 0) pp[i * 3 + 1] = -100;
      }
    }
    this.splashParticles.geometry.attributes.position.needsUpdate = true;

    // Ripple ring expansion
    if (this.splashRingActive) {
      this.splashRingTimer += delta;
      const p = Math.min(1, this.splashRingTimer / 0.9);
      const scale = 1 + p * 12;
      this.splashRing.scale.set(scale, scale, scale);
      this.splashRing.material.opacity = 0.7 * (1 - p);
      if (p >= 1) {
        this.splashRingActive = false;
        this.splashRing.visible = false;
      }
    }

    // Bobber float
    if (this.bobber.visible) {
      this.bobber.position.y = this.bobberTargetY + Math.sin(time * 3.0) * 0.08;
      this.updateFishingLine(this.bobber.position);
    }
  }

  render() {
    if (this.isLowGraphics) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
  }

  setGraphicsQuality(quality) {
    const isLow = quality === 'low';
    this.isLowGraphics = isLow;
    this.renderer.shadowMap.enabled = !isLow;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLow ? 1 : 2));
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    if (isLow) {
      this.isRaining = false;
      this.rain.visible = false;
      audio.setRainActive(false);
      this.stars.material.opacity = 0;
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}
