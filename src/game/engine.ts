import * as THREE from 'three';
import {
  BlockType,
  BLOCK_DEFS,
  BlockDefinition,
  GRAVITY,
  JUMP_VELOCITY,
  WALK_SPEED,
  SPRINT_SPEED,
  FLY_SPEED,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  EYE_HEIGHT,
  WORLD_SIZE_X,
  WORLD_SIZE_Z,
  CHUNK_SIZE,
} from './constants';
import { getBlockMaterials, getBreakStageMaterial } from './textures';
import { sound } from './audio';
import { createHeldModelForType, createLeftHeldModelForType } from './handModels';
import { BossMonster, BossFireball } from './boss';

export interface PlayerState {
  position: THREE.Vector3;
  rotation: { yaw: number; pitch: number };
  isGrounded: boolean;
  isFlying: boolean;
  isSprinting: boolean;
  isSneaking: boolean;
  health: number; // 0 to 20
  hunger: number; // 0 to 20
  isDead: boolean;
  gameMode: 'creative' | 'survival';
}

export interface BlockParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class VoxelGameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private container: HTMLElement;

  // World data: map of coordinate key "x,y,z" -> BlockType
  public worldBlocks: Map<string, BlockType> = new Map();

  // High-performance 16x16 Chunk Rendering (Zero stutter on block place/break, smooth FPS)
  private chunks: Map<string, THREE.Group> = new Map();
  private blockGeom: THREE.BoxGeometry;
  private torchStickGeom: THREE.BoxGeometry;
  private torchFlameGeom: THREE.BoxGeometry;
  private torchStickMat: THREE.MeshLambertMaterial;
  private torchFlameMat: THREE.MeshBasicMaterial;

  // Active light sources cache (torches & glowstones) for ultra-fast lighting (eliminates full-world loop)
  private lightSourceBlocks: Set<string> = new Set();

  // Chunk Distance Culling & FPS Management (30 FPS Lock & Zero Lag)
  public renderDistanceChunks: number = 4; // 4 chunks = 64 blocks radius (ideal balance)
  public targetFPS: number = 30; // 30 FPS lock by default
  private lastRenderTime: number = 0;
  private lastCullChunkX: number = 999999;
  private lastCullChunkZ: number = 999999;
  public currentFPS: number = 30;
  private fpsLastSampleTime: number = 0;
  private fpsFrames: number = 0;

  // Selection outline
  private selectionBox: THREE.LineSegments;
  public targetBlock: { x: number; y: number; z: number; normal: THREE.Vector3 } | null = null;

  // Player physics and state
  public player: PlayerState = {
    position: new THREE.Vector3(0, 16, 0),
    rotation: { yaw: 0, pitch: 0 },
    isGrounded: false,
    isFlying: false,
    isSprinting: false,
    isSneaking: false,
    health: 20,
    hunger: 20,
    isDead: false,
    gameMode: 'survival',
  };
  private velocity: THREE.Vector3 = new THREE.Vector3();
  public moveInput = { forward: 0, right: 0 };
  private highestAirY: number = 16;
  private starveTimer: number = 0;
  private regenTimer: number = 0;

  // Hurt flash state for UI
  public isHurtFlashing: boolean = false;
  private hurtTimer: number = 0;

  // First-person 3D hand / held item
  private handGroup: THREE.Group;
  private currentHeldModel: THREE.Group | null = null;
  private handSwingProgress: number = 0;
  private isSwinging: boolean = false;
  private walkBobTimer: number = 0;
  public activeHeldItem: BlockType = BlockType.WOODEN_PICKAXE;

  // Off-hand (Sol El / Left Hand)
  public leftHandGroup: THREE.Group;
  public offhandItem: BlockType = BlockType.AIR;
  private currentLeftHeldModel: THREE.Group | null = null;

  // Equipped Armor pieces (Helmet, Chestplate, Leggings, Boots)
  public equippedArmor: BlockType[] = [];

  // Extra meshes for placed 3D torches (slender stick + glowing emissive flame)
  private extraTorchMeshes: THREE.InstancedMesh[] = [];

  // Dynamic point lights pool for placed torches (10 lights dynamically positioned near player)
  private placedTorchLights: THREE.PointLight[] = [];

  // Boss Dragon state
  public boss: BossMonster | null = null;
  public bossFireballs: BossFireball[] = [];

  // Mining & Breaking System with realistic Minecraft duration & cracks
  public isMining: boolean = false;
  public miningProgress: number = 0; // 0.0 to 1.0
  public miningDuration: number = 1.0;
  public miningTarget: { x: number; y: number; z: number } | null = null;
  private miningCrackMesh: THREE.Mesh | null = null;
  private miningCrackBoxGeom = new THREE.BoxGeometry(1.006, 1.006, 1.006);
  private miningCrackSoundTimer: number = 0;
  private miningSwingTimer: number = 0;

  // Day-Night cycle state
  public timeOfDay: number = 0.25; // 0.00: sunrise, 0.25: noon, 0.50: sunset, 0.75: midnight
  public daySpeed: number = 0.0003; // speed of day progression
  public nightFactor: number = 0; // 0.0 (full day) to 1.0 (midnight darkness)
  public timePhase: 'dawn' | 'day' | 'sunset' | 'night' = 'day';
  public isHoldingLight: boolean = false;
  private torchLight: THREE.PointLight;
  private sunLight: THREE.DirectionalLight;
  private moonLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private skyMesh: THREE.Mesh;
  private cloudsMesh: THREE.Mesh;
  private starsMesh: THREE.Points;

  // Particles
  private particles: BlockParticle[] = [];

  // Mobs (Sheep & Cow)
  private mobs: {
    mesh: THREE.Group;
    legs: THREE.Mesh[];
    head: THREE.Mesh;
    pos: THREE.Vector3;
    targetPos: THREE.Vector3;
    rotY: number;
    walkTimer: number;
    health: number;
    type: 'sheep' | 'cow';
  }[] = [];

  // Callbacks
  public onBlockBreakCallback?: (block: BlockType, count: number) => void;
  public onItemPickupCallback?: (block: BlockType, count: number) => void;
  public onPlayerHurtCallback?: (newHealth: number, reason: string) => void;
  public onPlayerDieCallback?: () => void;
  public onMiningProgressCallback?: (
    progress: number,
    blockType: BlockType | null,
    requiredToolMet: boolean
  ) => void;
  public onToolWarningCallback?: (warning: string) => void;
  public onPortalFrameInteract?: (x: number, y: number, z: number) => boolean;
  public onCraftingTableInteract?: () => void;
  public onOffhandBlockUsedCallback?: () => void;
  public onBossHealthUpdate?: (health: number, maxHealth: number, isAlive: boolean) => void;
  public onTargetBlockChange?: (target: { x: number; y: number; z: number; blockType: BlockType } | null) => void;

  private lastNotifiedTarget: { x: number; y: number; z: number; blockType: BlockType } | null = null;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private stepSoundTimer: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x91c0ff, 0.018);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 120);
    this.camera.position.set(0, 16, 0);

    // 2. Renderer (Optimized for rock-solid 30/60 FPS on any device)
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(1.0); // 1.0 native pixel ratio prevents mobile GPU thermal throttling
    this.renderer.shadowMap.enabled = false; // keep fast on mobile
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    // 3. Shared geometry for blocks & torches
    this.blockGeom = new THREE.BoxGeometry(1, 1, 1);
    this.torchStickGeom = new THREE.BoxGeometry(0.12, 0.55, 0.12);
    this.torchStickGeom.translate(0, -0.2, 0);
    this.torchFlameGeom = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    this.torchFlameGeom.translate(0, 0.14, 0);
    this.torchStickMat = new THREE.MeshLambertMaterial({ color: 0x6e4a28 });
    this.torchFlameMat = new THREE.MeshBasicMaterial({ color: 0xffaa11 });

    // 4. Selection box outline
    const edges = new THREE.EdgesGeometry(this.blockGeom);
    this.selectionBox = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    this.selectionBox.scale.set(1.002, 1.002, 1.002);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    // 5. Sky, Sun, Moon & Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7d6, 1.0);
    this.sunLight.position.set(20, 50, 20);
    this.scene.add(this.sunLight);

    this.moonLight = new THREE.DirectionalLight(0x738ebb, 0.2);
    this.moonLight.position.set(-20, -50, -20);
    this.scene.add(this.moonLight);

    // Sun & Moon meshes
    const sunGeom = new THREE.PlaneGeometry(8, 8);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff6a8, side: THREE.DoubleSide });
    this.sunMesh = new THREE.Mesh(sunGeom, sunMat);
    this.scene.add(this.sunMesh);

    const moonGeom = new THREE.PlaneGeometry(6, 6);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0e7ff, side: THREE.DoubleSide });
    this.moonMesh = new THREE.Mesh(moonGeom, moonMat);
    this.scene.add(this.moonMesh);

    // Clouds canopy
    const cloudGeom = new THREE.PlaneGeometry(160, 160);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    this.cloudsMesh = new THREE.Mesh(cloudGeom, cloudMat);
    this.cloudsMesh.rotation.x = Math.PI / 2;
    this.cloudsMesh.position.y = 30;
    this.scene.add(this.cloudsMesh);

    // Sky dome
    const skyGeom = new THREE.SphereGeometry(180, 16, 12);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x78a7ff,
      side: THREE.BackSide,
      fog: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(this.skyMesh);

    // Stars dome for night sky
    const starCount = 450;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 175;
      const y = Math.abs(r * Math.cos(phi)) + 8; // upper hemisphere
      const x = r * Math.sin(phi) * Math.cos(theta);
      const z = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      transparent: true,
      opacity: 0,
      fog: false,
    });
    this.starsMesh = new THREE.Points(starGeom, starMat);
    this.scene.add(this.starsMesh);

    // Torch / handheld point light (dynamic light from torch in main or off-hand)
    this.torchLight = new THREE.PointLight(0xffa238, 0, 15, 1.8);
    this.camera.add(this.torchLight);

    // 6. First-Person Hand & Held Item (Minecraft 3D models)
    // 6.1 Right Hand (Main Hand)
    this.handGroup = new THREE.Group();
    this.handGroup.position.set(0.4, -0.4, -0.7);
    this.currentHeldModel = createHeldModelForType(this.activeHeldItem);
    this.currentHeldModel.userData.baseRotX = this.currentHeldModel.rotation.x;
    this.currentHeldModel.userData.baseRotY = this.currentHeldModel.rotation.y;
    this.currentHeldModel.userData.baseRotZ = this.currentHeldModel.rotation.z;
    this.handGroup.add(this.currentHeldModel);
    this.camera.add(this.handGroup);

    // 6.2 Left Hand (Sol El / Off-Hand)
    this.leftHandGroup = new THREE.Group();
    this.leftHandGroup.position.set(-0.4, -0.4, -0.7);
    this.camera.add(this.leftHandGroup);

    this.scene.add(this.camera);

    // 6.3 Placed Torches Dynamic Lighting Pool (10 warm point lights positioned at nearest torches)
    for (let i = 0; i < 10; i++) {
      const pl = new THREE.PointLight(0xffaa33, 0, 16, 1.8);
      this.scene.add(pl);
      this.placedTorchLights.push(pl);
    }

    // 7. Spawn initial mobs
    this.spawnMob('sheep', 2, 12, 2);
    this.spawnMob('cow', -4, 12, -3);

    // Resize listener
    window.addEventListener('resize', this.onResize);

    this.start();
  }

  // Update dynamic handheld lighting based on right hand OR left hand item
  public updateHandheldLighting() {
    const isLightSource =
      this.activeHeldItem === BlockType.TORCH ||
      this.activeHeldItem === BlockType.GLOWSTONE ||
      this.offhandItem === BlockType.TORCH ||
      this.offhandItem === BlockType.GLOWSTONE;

    this.isHoldingLight = isLightSource;
    this.torchLight.intensity = isLightSource ? 2.2 : 0;
  }

  public setHandBlock(blockType: BlockType) {
    this.activeHeldItem = blockType;
    if (this.currentHeldModel) {
      this.handGroup.remove(this.currentHeldModel);
    }
    this.currentHeldModel = createHeldModelForType(blockType);
    this.currentHeldModel.userData.baseRotX = this.currentHeldModel.rotation.x;
    this.currentHeldModel.userData.baseRotY = this.currentHeldModel.rotation.y;
    this.currentHeldModel.userData.baseRotZ = this.currentHeldModel.rotation.z;
    this.handGroup.add(this.currentHeldModel);

    this.updateHandheldLighting();
  }

  // Set item held in the Left Hand (Sol El / Off-Hand)
  public setOffhandBlock(blockType: BlockType) {
    this.offhandItem = blockType;
    if (this.currentLeftHeldModel) {
      this.leftHandGroup.remove(this.currentLeftHeldModel);
      this.currentLeftHeldModel = null;
    }
    if (blockType !== BlockType.AIR) {
      this.currentLeftHeldModel = createLeftHeldModelForType(blockType);
      this.leftHandGroup.add(this.currentLeftHeldModel);
    }
    this.updateHandheldLighting();
  }

  // Update equipped armor pieces
  public setEquippedArmor(armor: BlockType[]) {
    this.equippedArmor = [...armor];
  }

  // Spawn Ender Dragon Boss
  public spawnBoss(x: number, y: number, z: number) {
    if (this.boss && this.boss.isAlive) return;
    this.boss = new BossMonster(x, y + 10, z);
    this.scene.add(this.boss.group);
    if (this.onBossHealthUpdate) {
      this.onBossHealthUpdate(this.boss.health, this.boss.maxHealth, true);
    }
  }

  public triggerHandSwing() {
    this.isSwinging = true;
    this.handSwingProgress = 0;
  }

  private spawnMob(type: 'sheep' | 'cow', x: number, y: number, z: number) {
    const mobGroup = new THREE.Group();

    // Body
    const bodyColor = type === 'sheep' ? 0xefefef : 0x5a3d28;
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 1.2), bodyMat);
    body.position.y = 0.8;
    mobGroup.add(body);

    // Head
    const headColor = type === 'sheep' ? 0xd6c2a8 : 0x3d2719;
    const headMat = new THREE.MeshLambertMaterial({ color: headColor });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), headMat);
    head.position.set(0, 1.2, 0.7);
    mobGroup.add(head);

    // Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2e2319 });
    const legs: THREE.Mesh[] = [];
    const legOffsets = [
      [-0.3, 0.35, -0.4],
      [0.3, 0.35, -0.4],
      [-0.3, 0.35, 0.4],
      [0.3, 0.35, 0.4],
    ];

    legOffsets.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), legMat);
      leg.position.set(lx, ly, lz);
      mobGroup.add(leg);
      legs.push(leg);
    });

    mobGroup.position.set(x, y, z);
    this.scene.add(mobGroup);

    this.mobs.push({
      mesh: mobGroup,
      legs,
      head,
      pos: new THREE.Vector3(x, y, z),
      targetPos: new THREE.Vector3(x + (Math.random() - 0.5) * 6, y, z + (Math.random() - 0.5) * 6),
      rotY: 0,
      walkTimer: Math.random() * 10,
      health: 3,
      type,
    });
  }

  // Damage the player and trigger hurt reactions (applies armor defense & shield)
  public damagePlayer(amount: number, reason: string = 'Hasar') {
    if (this.player.gameMode !== 'survival' || this.player.isDead) return;

    // Calculate total armor defense damage reduction
    let reduction = 0;
    for (const item of this.equippedArmor) {
      const def = BLOCK_DEFS[item];
      if (def?.damageReduction) {
        reduction += def.damageReduction;
      }
    }
    // If shield is held in left hand, add extra 25% defense!
    if (this.offhandItem === BlockType.SHIELD) {
      reduction += 0.25;
    }

    reduction = Math.min(0.85, reduction); // Cap at 85% maximum reduction
    const actualDamage = Math.max(1, Math.round(amount * (1.0 - reduction)));

    this.player.health = Math.max(0, this.player.health - actualDamage);
    this.isHurtFlashing = true;
    this.hurtTimer = 0.35;
    sound.playHurt();

    if (this.onPlayerHurtCallback) {
      this.onPlayerHurtCallback(this.player.health, reason);
    }

    if (this.player.health <= 0) {
      this.player.isDead = true;
      if (this.onPlayerDieCallback) {
        this.onPlayerDieCallback();
      }
    }
  }

  // Heal player health
  public healPlayer(amount: number) {
    this.player.health = Math.min(20, this.player.health + amount);
  }

  // Restore hunger
  public feedPlayer(amount: number) {
    this.player.hunger = Math.min(20, this.player.hunger + amount);
  }

  // Eat held food item
  public eatFood(type: BlockType): boolean {
    const def = BLOCK_DEFS[type];
    if (!def || !def.isFood) return false;

    // Check if can eat (not already full unless golden apple)
    if (this.player.hunger >= 20 && this.player.health >= 20 && type !== BlockType.GOLDEN_APPLE) {
      return false;
    }

    this.triggerHandSwing();
    sound.playEat();

    this.feedPlayer(def.hungerRestore || 4);
    this.healPlayer(def.healthRestore || 2);
    return true;
  }

  // Respawn player at world surface
  public respawn() {
    this.player.isDead = false;
    this.player.health = 20;
    this.player.hunger = 20;
    const topY = this.findHighestBlock(0, 0) + EYE_HEIGHT + 2;
    this.player.position.set(0, topY, 0);
    this.velocity.set(0, 0, 0);
    this.highestAirY = topY;
  }

  // Check if player attacked a nearby mob or boss (damage scales with equipped sword!)
  public attackMob(): boolean {
    const reach = 4.2;
    const ray = new THREE.Ray();
    ray.origin.copy(this.camera.position);
    this.camera.getWorldDirection(ray.direction);

    const heldDef = BLOCK_DEFS[this.activeHeldItem];
    const dmg = heldDef?.attackDamage || 1;

    // 1. Check Dragon Boss if active
    if (this.boss && this.boss.isAlive) {
      const bossDist = this.boss.pos.distanceTo(this.camera.position);
      if (bossDist < 7.5) {
        this.triggerHandSwing();
        const defeated = this.boss.takeDamage(dmg, ray.direction.clone());
        this.spawnBlockParticles(this.boss.pos.x, this.boss.pos.y, this.boss.pos.z, '#b500d4');
        if (this.onBossHealthUpdate) {
          this.onBossHealthUpdate(this.boss.health, this.boss.maxHealth, this.boss.isAlive);
        }
        if (defeated) {
          this.scene.remove(this.boss.group);
          sound.playLevelUp();
          if (this.onToolWarningCallback) {
            this.onToolWarningCallback('🏆 EJDERHA YENİLDİ! DÜNYANIN KAHRAMANI OLDUN!');
          }
        }
        return true;
      }
    }

    // 2. Check peaceful mobs (sheep/cow)
    for (let i = 0; i < this.mobs.length; i++) {
      const mob = this.mobs[i];
      const dist = mob.pos.distanceTo(this.camera.position);
      if (dist < reach) {
        const mobBox = new THREE.Box3().setFromObject(mob.mesh);
        if (ray.intersectsBox(mobBox)) {
          this.triggerHandSwing();
          sound.playHurt();

          mob.health -= dmg;
          // Mob knockback
          const knockback = ray.direction.clone().multiplyScalar(1.5);
          knockback.y = 0.5;
          mob.pos.add(knockback);

          // Particles
          this.spawnBlockParticles(mob.pos.x, mob.pos.y + 0.5, mob.pos.z, '#b03b3b');

          if (mob.health <= 0) {
            // Drop meat & remove
            this.scene.remove(mob.mesh);
            this.mobs.splice(i, 1);
            sound.playPickup();

            if (this.onItemPickupCallback) {
              this.onItemPickupCallback(BlockType.RAW_BEEF, 2);
            }

            // Spawn replacement mob after delay
            setTimeout(() => {
              const rx = (Math.random() - 0.5) * 20;
              const rz = (Math.random() - 0.5) * 20;
              const ry = this.findHighestBlock(Math.round(rx), Math.round(rz));
              this.spawnMob(Math.random() > 0.5 ? 'cow' : 'sheep', rx, ry + 1, rz);
            }, 10000);
          }
          return true;
        }
      }
    }
    return false;
  }

  // Attack mob if in sight, otherwise mine/break target block
  public attackOrMine(): boolean {
    if (this.attackMob()) {
      return true;
    }
    return this.breakTargetBlock();
  }

  // Load world blocks and build instanced meshes
  public loadWorld(blocks: Map<string, BlockType>) {
    this.worldBlocks = new Map(blocks);

    // Build light source cache for fast lighting
    this.lightSourceBlocks.clear();
    this.worldBlocks.forEach((type, key) => {
      if (type === BlockType.TORCH || type === BlockType.GLOWSTONE) {
        this.lightSourceBlocks.add(key);
      }
    });

    this.rebuildAllMeshes();
    this.updateChunkDistanceCulling(true);

    // Position player safely on surface
    const spawnY = this.findHighestBlock(0, 0) + EYE_HEIGHT + 1;
    this.player.position.set(0, Math.max(spawnY, 12), 0);
    this.velocity.set(0, 0, 0);
  }

  public findHighestBlock(x: number, z: number): number {
    let maxY = 1;
    for (let y = 30; y >= 0; y--) {
      const type = this.worldBlocks.get(`${x},${y},${z}`);
      if (type !== undefined && type !== BlockType.AIR && type !== BlockType.WATER) {
        return y;
      }
    }
    return maxY;
  }

  // High-performance 16x16 Chunk Rebuild (takes ~0.3ms, preventing any block-breaking freeze)
  public rebuildChunk(cx: number, cz: number) {
    const chunkKey = `${cx},${cz}`;
    let group = this.chunks.get(chunkKey);
    if (!group) {
      group = new THREE.Group();
      this.scene.add(group);
      this.chunks.set(chunkKey, group);
    } else {
      while (group.children.length > 0) {
        const child = group.children[0] as THREE.InstancedMesh;
        group.remove(child);
      }
    }

    const minX = cx * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE - 1;
    const minZ = cz * CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE - 1;

    const blockPositionsByType = new Map<BlockType, THREE.Vector3[]>();

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = 0; y <= 48; y++) {
          const key = `${x},${y},${z}`;
          const blockType = this.worldBlocks.get(key);
          if (blockType === undefined || blockType === BlockType.AIR) continue;

          // Torches are always exposed; others check occlusion
          if (blockType !== BlockType.TORCH && !this.isBlockExposed(x, y, z)) {
            continue;
          }

          let list = blockPositionsByType.get(blockType);
          if (!list) {
            list = [];
            blockPositionsByType.set(blockType, list);
          }
          list.push(new THREE.Vector3(x, y, z));
        }
      }
    }

    const dummy = new THREE.Object3D();

    blockPositionsByType.forEach((positions, blockType) => {
      const count = positions.length;
      if (count === 0) return;

      if (blockType === BlockType.TORCH) {
        const stickMesh = new THREE.InstancedMesh(this.torchStickGeom, this.torchStickMat, count);
        stickMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const flameMesh = new THREE.InstancedMesh(this.torchFlameGeom, this.torchFlameMat, count);
        flameMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        for (let i = 0; i < count; i++) {
          dummy.position.copy(positions[i]);
          dummy.updateMatrix();
          stickMesh.setMatrixAt(i, dummy.matrix);
          flameMesh.setMatrixAt(i, dummy.matrix);
        }

        stickMesh.instanceMatrix.needsUpdate = true;
        flameMesh.instanceMatrix.needsUpdate = true;
        group.add(stickMesh);
        group.add(flameMesh);
        return;
      }

      const materials = getBlockMaterials(blockType);
      const instancedMesh = new THREE.InstancedMesh(this.blockGeom, materials, count);
      instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      for (let i = 0; i < count; i++) {
        dummy.position.copy(positions[i]);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      group.add(instancedMesh);
    });
  }

  // Rebuild all chunks across the world
  public rebuildAllMeshes() {
    this.chunks.forEach((group) => {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      this.scene.remove(group);
    });
    this.chunks.clear();

    const halfX = Math.floor(WORLD_SIZE_X / 2);
    const halfZ = Math.floor(WORLD_SIZE_Z / 2);
    const minCx = Math.floor(-halfX / CHUNK_SIZE);
    const maxCx = Math.floor(halfX / CHUNK_SIZE);
    const minCz = Math.floor(-halfZ / CHUNK_SIZE);
    const maxCz = Math.floor(halfZ / CHUNK_SIZE);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        this.rebuildChunk(cx, cz);
      }
    }
  }

  // Quick check if a block has at least one transparent/empty neighbor
  private isBlockExposed(x: number, y: number, z: number): boolean {
    const neighbors = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    for (const [dx, dy, dz] of neighbors) {
      const neighborKey = `${x + dx},${y + dy},${z + dz}`;
      const nType = this.worldBlocks.get(neighborKey);
      if (nType === undefined || nType === BlockType.AIR || BLOCK_DEFS[nType]?.transparent) {
        return true;
      }
    }
    return false;
  }

  public getBlock(x: number, y: number, z: number): BlockType {
    return this.worldBlocks.get(`${x},${y},${z}`) || BlockType.AIR;
  }

  public setBlock(x: number, y: number, z: number, type: BlockType) {
    const key = `${x},${y},${z}`;
    if (type === BlockType.AIR) {
      this.worldBlocks.delete(key);
      this.lightSourceBlocks.delete(key);
    } else {
      this.worldBlocks.set(key, type);
      if (type === BlockType.TORCH || type === BlockType.GLOWSTONE) {
        this.lightSourceBlocks.add(key);
      } else {
        this.lightSourceBlocks.delete(key);
      }
    }

    // Rebuild only the affected chunk(s) (instant: ~0.3ms, completely eliminates frame freeze!)
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    this.rebuildChunk(cx, cz);

    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    if (localX === 0) this.rebuildChunk(cx - 1, cz);
    if (localX === CHUNK_SIZE - 1) this.rebuildChunk(cx + 1, cz);
    if (localZ === 0) this.rebuildChunk(cx, cz - 1);
    if (localZ === CHUNK_SIZE - 1) this.rebuildChunk(cx, cz + 1);

    this.updateChunkDistanceCulling(true);
  }

  // Dynamically cull chunks outside render distance to keep GPU draw calls low and FPS rock-solid
  public updateChunkDistanceCulling(force: boolean = false) {
    const pcx = Math.floor(this.player.position.x / CHUNK_SIZE);
    const pcz = Math.floor(this.player.position.z / CHUNK_SIZE);

    if (!force && pcx === this.lastCullChunkX && pcz === this.lastCullChunkZ) {
      return;
    }
    this.lastCullChunkX = pcx;
    this.lastCullChunkZ = pcz;

    const rd = this.renderDistanceChunks;
    this.chunks.forEach((group, chunkKey) => {
      const [cx, cz] = chunkKey.split(',').map(Number);
      const dist = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz));
      group.visible = dist <= rd;
    });
  }

  public setRenderDistance(chunks: number) {
    this.renderDistanceChunks = chunks;
    this.updateChunkDistanceCulling(true);
    if (this.scene.fog) {
      const maxDistance = chunks * CHUNK_SIZE;
      (this.scene.fog as THREE.FogExp2).density = Math.max(0.012, 1.25 / maxDistance);
    }
  }

  public setTargetFPS(fps: number) {
    this.targetFPS = fps;
  }

  public setPerformanceMode(enabled: boolean) {
    if (enabled) {
      this.renderer.setPixelRatio(1.0);
      this.setTargetFPS(30);
      this.setRenderDistance(3);
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      this.setTargetFPS(60);
      this.setRenderDistance(5);
    }
  }

  // Start mining the currently targeted block (continuous hold)
  public startMining() {
    if (!this.targetBlock) return;
    const { x, y, z } = this.targetBlock;
    const blockType = this.getBlock(x, y, z);
    if (blockType === BlockType.AIR || blockType === BlockType.BEDROCK) return;

    if (this.player.gameMode === 'creative') {
      // In Creative mode: instant break
      this.finishMining(x, y, z, blockType);
      return;
    }

    this.isMining = true;
    this.miningProgress = 0;
    this.miningTarget = { x, y, z };
    this.miningCrackSoundTimer = 0;
    this.miningSwingTimer = 0;
  }

  // Stop mining when release button / mouse
  public stopMining() {
    this.isMining = false;
    this.miningProgress = 0;
    this.miningTarget = null;
    if (this.miningCrackMesh) {
      this.miningCrackMesh.visible = false;
    }
    if (this.onMiningProgressCallback) {
      this.onMiningProgressCallback(0, null, true);
    }
  }

  // Update progressive mining with cracks, tool speed multiplier and requirements
  public updateMining(dt: number) {
    if (!this.isMining) return;

    if (!this.targetBlock) {
      this.stopMining();
      return;
    }

    const { x, y, z } = this.targetBlock;
    if (
      !this.miningTarget ||
      this.miningTarget.x !== x ||
      this.miningTarget.y !== y ||
      this.miningTarget.z !== z
    ) {
      this.miningTarget = { x, y, z };
      this.miningProgress = 0;
    }

    const blockType = this.getBlock(x, y, z);
    if (blockType === BlockType.AIR || blockType === BlockType.BEDROCK) {
      this.stopMining();
      return;
    }

    const targetDef = BLOCK_DEFS[blockType];
    const heldDef = BLOCK_DEFS[this.activeHeldItem];

    // Tool speed multiplier
    let speedMultiplier = 1.0;
    const isPickaxe = heldDef?.toolType === 'pickaxe';
    const isAxe = heldDef?.toolType === 'axe';

    if (targetDef.requiredToolType === 'pickaxe' && isPickaxe) {
      speedMultiplier = heldDef?.miningMultiplier || 2.5;
    } else if (targetDef.soundType === 'wood' && isAxe) {
      speedMultiplier = heldDef?.miningMultiplier || 3.0;
    } else if (heldDef?.toolType === 'sword') {
      speedMultiplier = 1.4;
    }

    const baseTime = targetDef.baseBreakTime || 1.0;
    this.miningDuration = Math.max(0.12, baseTime / speedMultiplier);
    this.miningProgress += dt / this.miningDuration;

    // Periodic mining hit / tap sound
    this.miningCrackSoundTimer += dt;
    if (this.miningCrackSoundTimer >= 0.26) {
      this.miningCrackSoundTimer = 0;
      sound.playStep(targetDef.soundType || 'dirt');
    }

    // Progressive cracking overlay mesh
    const crackStage = Math.min(9, Math.floor(this.miningProgress * 10));
    if (!this.miningCrackMesh) {
      this.miningCrackMesh = new THREE.Mesh(
        this.miningCrackBoxGeom,
        getBreakStageMaterial(0)
      );
      this.scene.add(this.miningCrackMesh);
    }
    this.miningCrackMesh.visible = true;
    this.miningCrackMesh.position.set(x, y, z);
    this.miningCrackMesh.material = getBreakStageMaterial(crackStage);

    // Tool requirement check: e.g. Diamond Ore requires Iron Pickaxe (Tier 3) or better!
    const reqTier = targetDef.requiredToolTier || 0;
    const heldTier = heldDef?.toolTier || 0;
    const reqMet = reqTier === 0 || (isPickaxe && heldTier >= reqTier);

    if (this.onMiningProgressCallback) {
      this.onMiningProgressCallback(this.miningProgress, blockType, reqMet);
    }

    if (this.miningProgress >= 1.0) {
      this.finishMining(x, y, z, blockType, targetDef, heldDef);
      this.stopMining();
    }
  }

  // Complete block mining and handle Minecraft tool tier drop logic
  public finishMining(
    x: number,
    y: number,
    z: number,
    blockType: BlockType,
    targetDef?: BlockDefinition,
    heldDef?: BlockDefinition
  ) {
    const tDef = targetDef || BLOCK_DEFS[blockType];
    const hDef = heldDef || BLOCK_DEFS[this.activeHeldItem];

    this.triggerHandSwing();

    // Check required tool tier for resource drop!
    const reqTier = tDef.requiredToolTier || 0;
    const heldTier = hDef?.toolTier || 0;
    const isPickaxe = hDef?.toolType === 'pickaxe';
    const hasProperTool =
      this.player.gameMode === 'creative' ||
      reqTier === 0 ||
      (isPickaxe && heldTier >= reqTier);

    // Play block break sound & particles
    sound.playBlockBreak(tDef.soundType || 'dirt');
    this.spawnBlockParticles(x, y, z, tDef.iconColor || '#777777');

    // Remove block from world
    this.setBlock(x, y, z, BlockType.AIR);

    if (hasProperTool) {
      // In Minecraft: Mining ores drops minerals/gems, NOT the ore block!
      // User request: "Madenleri kazınca Cevher olarak elimize gelsin blok olarak değil"
      let dropType = blockType;
      if (blockType === BlockType.STONE) {
        dropType = BlockType.COBBLESTONE;
      } else if (
        blockType === BlockType.DIAMOND_ORE ||
        blockType === BlockType.DEEPSLATE_DIAMOND_ORE
      ) {
        dropType = BlockType.DIAMOND; // Normal Elmas!
      } else if (
        blockType === BlockType.COAL_ORE ||
        blockType === BlockType.DEEPSLATE_COAL_ORE
      ) {
        dropType = BlockType.COAL;
      } else if (
        blockType === BlockType.IRON_ORE ||
        blockType === BlockType.DEEPSLATE_IRON_ORE
      ) {
        dropType = BlockType.RAW_IRON;
      } else if (
        blockType === BlockType.GOLD_ORE ||
        blockType === BlockType.DEEPSLATE_GOLD_ORE
      ) {
        dropType = BlockType.RAW_GOLD;
      } else if (
        blockType === BlockType.COPPER_ORE ||
        blockType === BlockType.DEEPSLATE_COPPER_ORE
      ) {
        dropType = BlockType.RAW_COPPER;
      }

      if (this.onItemPickupCallback) {
        this.onItemPickupCallback(dropType, 1);

        // Nature drop chances
        if (blockType === BlockType.LEAVES && Math.random() < 0.22) {
          this.onItemPickupCallback(BlockType.APPLE, 1);
        } else if (blockType === BlockType.GRASS && Math.random() < 0.16) {
          this.onItemPickupCallback(BlockType.WHEAT, 1);
        }
      }
    } else {
      // Missing proper pickaxe tier! In Minecraft, breaking diamond or gold without iron pickaxe drops nothing!
      let neededTool = 'Tahta Kazma';
      if (reqTier === 2) neededTool = 'Taş Kazma';
      else if (reqTier === 3) neededTool = 'Demir Kazma';
      else if (reqTier === 4) neededTool = 'Elmas Kazma';

      if (this.onToolWarningCallback) {
        this.onToolWarningCallback(
          `⚠️ ${tDef.nameTr || tDef.name} kazmak için ${neededTool} (veya daha iyisi) gerekiyor! Eşya düşmedi.`
        );
      }
    }

    if (this.onBlockBreakCallback) {
      this.onBlockBreakCallback(blockType, 1);
    }
  }

  // Break currently targeted block immediately
  public breakTargetBlock(): boolean {
    if (!this.targetBlock) return false;
    const { x, y, z } = this.targetBlock;
    const currentBlock = this.getBlock(x, y, z);
    if (currentBlock === BlockType.AIR || currentBlock === BlockType.BEDROCK) {
      return false;
    }
    this.finishMining(x, y, z, currentBlock);
    return true;
  }

  // Place active block against target block's normal face (supports offhand placement & portal frame/table interactions)
  public placeBlock(blockType: BlockType): boolean {
    if (!this.targetBlock) return false;

    const { x, y, z, normal } = this.targetBlock;
    const targetType = this.getBlock(x, y, z);

    // 1. Interactive Blocks: End Portal Frame & Crafting Table
    if (targetType === BlockType.END_PORTAL_FRAME && this.onPortalFrameInteract) {
      if (this.onPortalFrameInteract(x, y, z)) {
        this.triggerHandSwing();
        return true;
      }
    }

    if (targetType === BlockType.CRAFTING_TABLE && this.onCraftingTableInteract) {
      this.onCraftingTableInteract();
      return true;
    }

    // 2. Determine which block to place (Main hand vs Off-Hand fallback)
    let toPlace = blockType;
    let fromOffhand = false;

    if (toPlace === BlockType.AIR || BLOCK_DEFS[toPlace]?.isPlaceable === false) {
      if (this.offhandItem !== BlockType.AIR && BLOCK_DEFS[this.offhandItem]?.isPlaceable !== false) {
        toPlace = this.offhandItem;
        fromOffhand = true;
      } else {
        return false;
      }
    }

    const placeX = x + normal.x;
    const placeY = y + normal.y;
    const placeZ = z + normal.z;

    // Check collision with player AABB (torches are non-solid so allow placing near feet)
    if (toPlace !== BlockType.TORCH) {
      const pMinX = this.player.position.x - PLAYER_RADIUS;
      const pMaxX = this.player.position.x + PLAYER_RADIUS;
      const pMinY = this.player.position.y - EYE_HEIGHT;
      const pMaxY = pMinY + PLAYER_HEIGHT;
      const pMinZ = this.player.position.z - PLAYER_RADIUS;
      const pMaxZ = this.player.position.z + PLAYER_RADIUS;

      const bMinX = placeX - 0.5;
      const bMaxX = placeX + 0.5;
      const bMinY = placeY - 0.5;
      const bMaxY = placeY + 0.5;
      const bMinZ = placeZ - 0.5;
      const bMaxZ = placeZ + 0.5;

      const intersectsPlayer =
        pMinX < bMaxX &&
        pMaxX > bMinX &&
        pMinY < bMaxY &&
        pMaxY > bMinY &&
        pMinZ < bMaxZ &&
        pMaxZ > bMinZ;

      if (intersectsPlayer) {
        return false; // Cannot place solid block inside player
      }
    }

    this.triggerHandSwing();

    // Place block
    this.setBlock(placeX, placeY, placeZ, toPlace);

    // Notify offhand usage if placed from offhand
    if (fromOffhand && this.onOffhandBlockUsedCallback) {
      this.onOffhandBlockUsedCallback();
    }

    // Play sound
    const soundType = BLOCK_DEFS[toPlace]?.soundType || 'dirt';
    sound.playBlockPlace(soundType);

    return true;
  }

  private spawnBlockParticles(x: number, y: number, z: number, color: string) {
    const particleGeom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const particleMat = new THREE.MeshBasicMaterial({ color });

    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(particleGeom, particleMat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.6,
        y + (Math.random() - 0.5) * 0.6,
        z + (Math.random() - 0.5) * 0.6
      );
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4
        ),
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
      });
    }
  }

  // Raycasting for target block selection
  private updateRaycast() {
    const reachDistance = 5.2;
    const ray = new THREE.Ray();
    ray.origin.copy(this.camera.position);
    this.camera.getWorldDirection(ray.direction);

    // Step through the voxel grid (Fast Voxel Raycast DDA)
    let px = ray.origin.x;
    let py = ray.origin.y;
    let pz = ray.origin.z;

    const step = 0.08;
    const maxSteps = reachDistance / step;

    let hit = false;
    let lastX = Math.round(px);
    let lastY = Math.round(py);
    let lastZ = Math.round(pz);

    for (let i = 0; i < maxSteps; i++) {
      px += ray.direction.x * step;
      py += ray.direction.y * step;
      pz += ray.direction.z * step;

      const bx = Math.round(px);
      const by = Math.round(py);
      const bz = Math.round(pz);

      if (bx !== lastX || by !== lastY || bz !== lastZ) {
        const block = this.getBlock(bx, by, bz);
        if (block !== BlockType.AIR && block !== BlockType.WATER) {
          // Found targeted block
          const normal = new THREE.Vector3(lastX - bx, lastY - by, lastZ - bz).normalize();
          this.targetBlock = { x: bx, y: by, z: bz, normal };
          this.selectionBox.position.set(bx, by, bz);
          this.selectionBox.visible = true;
          hit = true;
          break;
        }
        lastX = bx;
        lastY = by;
        lastZ = bz;
      }
    }

    if (!hit) {
      this.targetBlock = null;
      this.selectionBox.visible = false;
      if (this.lastNotifiedTarget !== null) {
        this.lastNotifiedTarget = null;
        if (this.onTargetBlockChange) {
          this.onTargetBlockChange(null);
        }
      }
    } else if (this.targetBlock) {
      const block = this.getBlock(this.targetBlock.x, this.targetBlock.y, this.targetBlock.z);
      if (
        !this.lastNotifiedTarget ||
        this.lastNotifiedTarget.x !== this.targetBlock.x ||
        this.lastNotifiedTarget.y !== this.targetBlock.y ||
        this.lastNotifiedTarget.z !== this.targetBlock.z ||
        this.lastNotifiedTarget.blockType !== block
      ) {
        this.lastNotifiedTarget = {
          x: this.targetBlock.x,
          y: this.targetBlock.y,
          z: this.targetBlock.z,
          blockType: block,
        };
        if (this.onTargetBlockChange) {
          this.onTargetBlockChange(this.lastNotifiedTarget);
        }
      }
    }
  }

  // Explicitly interact with targeted End Portal Frame (for user-requested "Yerleştir" button)
  public interactWithPortalFrame(): boolean {
    if (!this.targetBlock) return false;
    const { x, y, z } = this.targetBlock;
    const block = this.getBlock(x, y, z);
    if (block === BlockType.END_PORTAL_FRAME && this.onPortalFrameInteract) {
      const res = this.onPortalFrameInteract(x, y, z);
      if (res) {
        this.triggerHandSwing();
      }
      return res;
    }
    return false;
  }

  // Player physics and AABB collision resolution
  private updatePlayer(dt: number) {
    const speed = this.player.isFlying
      ? FLY_SPEED
      : this.player.isSprinting
      ? SPRINT_SPEED
      : WALK_SPEED;

    // Camera forward and right vectors projected onto XZ horizontal plane
    const forward = new THREE.Vector3(
      -Math.sin(this.player.rotation.yaw),
      0,
      -Math.cos(this.player.rotation.yaw)
    ).normalize();

    const right = new THREE.Vector3(
      Math.cos(this.player.rotation.yaw),
      0,
      -Math.sin(this.player.rotation.yaw)
    ).normalize();

    // Input movement vector
    const moveDir = new THREE.Vector3()
      .addScaledVector(forward, this.moveInput.forward)
      .addScaledVector(right, this.moveInput.right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.velocity.x = moveDir.x * speed;
      this.velocity.z = moveDir.z * speed;

      // Footstep sounds
      this.stepSoundTimer += dt;
      if (this.player.isGrounded && this.stepSoundTimer > (this.player.isSprinting ? 0.3 : 0.45)) {
        this.stepSoundTimer = 0;
        const groundY = Math.floor(this.player.position.y - EYE_HEIGHT - 0.1);
        const blockBelow = this.getBlock(
          Math.round(this.player.position.x),
          groundY,
          Math.round(this.player.position.z)
        );
        const soundType = BLOCK_DEFS[blockBelow]?.soundType || 'grass';
        sound.playStep(soundType);
      }
    } else {
      this.velocity.x *= 0.6;
      this.velocity.z *= 0.6;
    }

    // Vertical velocity & gravity
    if (this.player.isFlying) {
      this.velocity.y *= 0.85;
    } else {
      this.velocity.y -= GRAVITY * dt;
    }

    // Apply movement with axis-aligned collision resolution
    this.moveWithCollision(dt);

    // Update camera position
    this.camera.position.set(
      this.player.position.x,
      this.player.position.y,
      this.player.position.z
    );

    // Camera rotation
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.x = this.player.rotation.pitch;
    euler.y = this.player.rotation.yaw;
    this.camera.quaternion.setFromEuler(euler);

    // Hand bobbing animation
    const isMoving = this.moveInput.forward !== 0 || this.moveInput.right !== 0;
    if (isMoving && this.player.isGrounded) {
      this.walkBobTimer += dt * (this.player.isSprinting ? 14 : 9);
      const bobX = Math.sin(this.walkBobTimer * 0.5) * 0.03;
      const bobY = Math.cos(this.walkBobTimer) * 0.03;
      this.handGroup.position.set(0.4 + bobX, -0.4 + bobY, -0.7);
    } else {
      this.handGroup.position.lerp(new THREE.Vector3(0.4, -0.4, -0.7), 0.15);
    }

    // Hand swing animation (continuous while mining or single swing on action)
    if (this.currentHeldModel) {
      const baseRotX = this.currentHeldModel.userData.baseRotX ?? 0.35;
      const baseRotZ = this.currentHeldModel.userData.baseRotZ ?? 0.25;

      if (this.isMining) {
        this.miningSwingTimer += dt * 8.5;
        const swing = Math.sin(this.miningSwingTimer) * 0.45;
        this.currentHeldModel.rotation.x = baseRotX + swing;
        this.currentHeldModel.rotation.z = baseRotZ - swing * 0.3;
      } else if (this.isSwinging) {
        this.handSwingProgress += dt * 7;
        const angle = Math.sin(this.handSwingProgress * Math.PI) * 0.55;
        this.currentHeldModel.rotation.x = baseRotX + angle;
        this.currentHeldModel.rotation.z = baseRotZ - angle * 0.35;
        if (this.handSwingProgress >= 1) {
          this.isSwinging = false;
          this.currentHeldModel.rotation.x = baseRotX;
          this.currentHeldModel.rotation.z = baseRotZ;
        }
      }
    }

    // Survival mechanics: Hunger depletion, Starvation & Health Regeneration
    if (this.player.gameMode === 'survival' && !this.player.isDead) {
      // Hunger depletion over time
      const hungerLossRate = this.player.isSprinting ? 0.08 : (isMoving ? 0.03 : 0.008);
      this.player.hunger = Math.max(0, this.player.hunger - hungerLossRate * dt);

      // Starvation damage when hunger is zero
      if (this.player.hunger <= 0) {
        this.starveTimer += dt;
        if (this.starveTimer >= 3.5) {
          this.starveTimer = 0;
          this.damagePlayer(1, 'Açlıktan Hasar');
        }
      } else {
        this.starveTimer = 0;
      }

      // Natural health regen when well-fed (hunger >= 18)
      if (this.player.hunger >= 18 && this.player.health < 20) {
        this.regenTimer += dt;
        if (this.regenTimer >= 4.0) {
          this.regenTimer = 0;
          this.healPlayer(1);
          this.player.hunger = Math.max(0, this.player.hunger - 0.4);
        }
      } else {
        this.regenTimer = 0;
      }
    }

    // Hurt flash timer for screen damage effect
    if (this.isHurtFlashing) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) {
        this.isHurtFlashing = false;
      }
    }
  }

  public jump() {
    if (this.player.isFlying) {
      this.velocity.y = FLY_SPEED;
    } else if (this.player.isGrounded) {
      this.velocity.y = JUMP_VELOCITY;
      this.player.isGrounded = false;
      sound.playJump();
    }
  }

  public sneakDown() {
    if (this.player.isFlying) {
      this.velocity.y = -FLY_SPEED;
    }
  }

  public toggleFly() {
    if (this.player.gameMode === 'creative') {
      this.player.isFlying = !this.player.isFlying;
      this.velocity.y = 0;
    }
  }

  // Helper to determine if a block acts as a solid obstacle
  public isSolidBlock(blockType: BlockType): boolean {
    if (
      blockType === BlockType.AIR ||
      blockType === BlockType.WATER ||
      blockType === BlockType.TORCH ||
      blockType === BlockType.END_PORTAL
    ) {
      return false;
    }
    return true;
  }

  // 3-axis collision resolution with voxel grid, sub-stepping & tunneling prevention
  private moveWithCollision(dt: number) {
    const p = this.player.position;
    const v = this.velocity;

    // Clamp physics dt to 0.033s (30fps equivalent) to eliminate tunneling during lag spikes
    const safeDt = Math.min(dt, 0.033);

    // Limit maximum downward falling velocity
    v.y = Math.max(v.y, -22);

    // Sub-step movement if velocity is high to prevent tunneling through ground
    const maxMove = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * safeDt;
    const steps = Math.max(1, Math.min(4, Math.ceil(maxMove / 0.25)));
    const subDt = safeDt / steps;

    for (let s = 0; s < steps; s++) {
      // X axis
      p.x += v.x * subDt;
      if (this.checkCollision(p.x, p.y, p.z)) {
        p.x -= v.x * subDt;
        v.x = 0;
      }

      // Z axis
      p.z += v.z * subDt;
      if (this.checkCollision(p.x, p.y, p.z)) {
        p.z -= v.z * subDt;
        v.z = 0;
      }

      // Y axis
      p.y += v.y * subDt;
      if (this.checkCollision(p.x, p.y, p.z)) {
        if (v.y < 0) {
          if (!this.player.isGrounded) {
            // Landing from airborne
            const fallDistance = this.highestAirY - p.y;
            if (fallDistance > 3.6 && this.player.gameMode === 'survival' && !this.player.isFlying) {
              const damage = Math.floor(fallDistance - 3);
              this.damagePlayer(damage, 'Düşme Hasarı');
            }
            this.highestAirY = p.y;
          }
          this.player.isGrounded = true;
        }
        p.y -= v.y * subDt;
        v.y = 0;
      } else {
        this.player.isGrounded = false;
        if (p.y > this.highestAirY) {
          this.highestAirY = p.y;
        }
      }
    }

    // Anti-stuck resolution: If player is ever intersecting a solid block, unstick upwards safely
    if (this.checkCollision(p.x, p.y, p.z) && !this.player.isFlying) {
      for (let offset = 0.05; offset <= 1.0; offset += 0.05) {
        if (!this.checkCollision(p.x, p.y + offset, p.z)) {
          p.y += offset;
          this.velocity.y = 0;
          this.player.isGrounded = true;
          break;
        }
      }
    }

    // Deep void safety: Only triggers if truly fallen off the world below y = -40
    // Restores safely above current (x, z) terrain to avoid annoying teleports back to spawn
    if (p.y < -40) {
      const safeX = Math.round(p.x);
      const safeZ = Math.round(p.z);
      const topY = this.findHighestBlock(safeX, safeZ);
      p.set(safeX, topY + EYE_HEIGHT + 1.2, safeZ);
      v.set(0, 0, 0);
    }
  }

  // True 3D AABB vs Block AABB collision check
  private checkCollision(px: number, py: number, pz: number): boolean {
    const pMinX = px - PLAYER_RADIUS;
    const pMaxX = px + PLAYER_RADIUS;
    const pMinY = py - EYE_HEIGHT;
    const pMaxY = py - EYE_HEIGHT + PLAYER_HEIGHT;
    const pMinZ = pz - PLAYER_RADIUS;
    const pMaxZ = pz + PLAYER_RADIUS;

    // Absolute solid bedrock floor safety at y = 0
    if (pMinY < 0.5) {
      return true;
    }

    const minBx = Math.floor(pMinX - 0.5);
    const maxBx = Math.ceil(pMaxX + 0.5);
    const minBy = Math.floor(pMinY - 0.5);
    const maxBy = Math.ceil(pMaxY + 0.5);
    const minBz = Math.floor(pMinZ - 0.5);
    const maxBz = Math.ceil(pMaxZ + 0.5);

    for (let x = minBx; x <= maxBx; x++) {
      for (let y = minBy; y <= maxBy; y++) {
        for (let z = minBz; z <= maxBz; z++) {
          const block = this.getBlock(x, y, z);
          if (!this.isSolidBlock(block)) continue;

          // Block occupies [x - 0.5, x + 0.5], [y - 0.5, y + 0.5], [z - 0.5, z + 0.5]
          const bMinX = x - 0.5;
          const bMaxX = x + 0.5;
          const bMinY = y - 0.5;
          const bMaxY = y + 0.5;
          const bMinZ = z - 0.5;
          const bMaxZ = z + 0.5;

          if (
            pMinX < bMaxX &&
            pMaxX > bMinX &&
            pMinY < bMaxY &&
            pMaxY > bMinY &&
            pMinZ < bMaxZ &&
            pMaxZ > bMinZ
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public setTimeOfDay(time: number) {
    this.timeOfDay = ((time % 1.0) + 1.0) % 1.0;
  }

  // Update Day-Night lighting and sky
  private updateSkyAndLighting(dt: number) {
    this.timeOfDay = (this.timeOfDay + this.daySpeed * dt) % 1.0;

    // Angle: 0 -> sunrise (East), 0.25 -> noon (Zenith), 0.50 -> sunset (West), 0.75 -> midnight (Nadir)
    const angle = this.timeOfDay * Math.PI * 2;
    const sunDistance = 85;

    const sunX = -Math.cos(angle) * sunDistance;
    const sunY = Math.sin(angle) * sunDistance;
    const sunZ = Math.sin(angle * 0.5) * 22;

    this.sunMesh.position.set(sunX, sunY, sunZ);
    this.sunMesh.lookAt(0, 0, 0);

    const moonX = -sunX;
    const moonY = -sunY;
    const moonZ = -sunZ;
    this.moonMesh.position.set(moonX, moonY, moonZ);
    this.moonMesh.lookAt(0, 0, 0);

    this.sunLight.position.set(sunX, Math.max(1, sunY), sunZ);
    this.moonLight.position.set(moonX, Math.max(1, moonY), moonZ);

    // Sky colors
    const cDaySky = new THREE.Color(0x6aa5ff);
    const cDayFog = new THREE.Color(0x91beff);
    const cDawnHorizon = new THREE.Color(0xff7b36);
    const cDawnFog = new THREE.Color(0xe8956e);
    const cSunsetHorizon = new THREE.Color(0xff4414);
    const cSunsetSky = new THREE.Color(0x6e3366);
    const cSunsetFog = new THREE.Color(0xb84742);
    const cNightSky = new THREE.Color(0x050816);
    const cNightFog = new THREE.Color(0x080d22);

    const t = this.timeOfDay;
    const skyColor = new THREE.Color();
    const fogColor = new THREE.Color();
    const cloudColor = new THREE.Color(0xffffff);
    let cloudOpacity = 0.7;
    let starsOpacity = 0;
    let sunIntensity = 0;
    let moonIntensity = 0;
    let ambientIntensity = 0.55;

    if (t >= 0.90 || t < 0.18) {
      // SUNRISE / DAWN PHASE
      this.timePhase = 'dawn';
      const p = t >= 0.90 ? (t - 0.90) / 0.28 : (t + 0.10) / 0.28;

      if (p < 0.5) {
        const k = p / 0.5;
        skyColor.copy(cNightSky).lerp(cDawnHorizon, k);
        fogColor.copy(cNightFog).lerp(cDawnFog, k);
        this.nightFactor = 1.0 - k * 0.6;
        cloudColor.set(0x352d47).lerp(new THREE.Color(0xffaa7d), k);
        starsOpacity = (1.0 - k) * 0.9;
        ambientIntensity = 0.14 + k * 0.2;
      } else {
        const k = (p - 0.5) / 0.5;
        skyColor.copy(cDawnHorizon).lerp(cDaySky, k);
        fogColor.copy(cDawnFog).lerp(cDayFog, k);
        this.nightFactor = (1.0 - k) * 0.4;
        cloudColor.set(0xffaa7d).lerp(new THREE.Color(0xffffff), k);
        starsOpacity = 0;
        ambientIntensity = 0.34 + k * 0.3;
        sunIntensity = k * 1.1;
      }

      (this.sunMesh.material as THREE.MeshBasicMaterial).color.set(0xffd485);
      this.sunMesh.scale.set(1.2, 1.2, 1.2);
    } else if (t >= 0.18 && t < 0.44) {
      // FULL DAY / NOON
      this.timePhase = 'day';
      this.nightFactor = 0;
      skyColor.copy(cDaySky);
      fogColor.copy(cDayFog);
      cloudColor.set(0xffffff);
      cloudOpacity = 0.75;
      starsOpacity = 0;
      ambientIntensity = 0.65;
      sunIntensity = 1.25;
      moonIntensity = 0;

      (this.sunMesh.material as THREE.MeshBasicMaterial).color.set(0xfffae0);
      this.sunMesh.scale.set(1.0, 1.0, 1.0);
    } else if (t >= 0.44 && t < 0.60) {
      // SUNSET / DUSK PHASE
      this.timePhase = 'sunset';
      const p = (t - 0.44) / 0.16;

      if (p < 0.5) {
        const k = p / 0.5;
        skyColor.copy(cDaySky).lerp(cSunsetHorizon, k);
        fogColor.copy(cDayFog).lerp(cSunsetFog, k);
        this.nightFactor = k * 0.45;
        cloudColor.set(0xffffff).lerp(new THREE.Color(0xff8550), k);
        sunIntensity = (1.0 - k) * 1.0;
        ambientIntensity = 0.6 - k * 0.25;
      } else {
        const k = (p - 0.5) / 0.5;
        skyColor.copy(cSunsetHorizon).lerp(cSunsetSky, k * 0.6).lerp(cNightSky, k);
        fogColor.copy(cSunsetFog).lerp(cNightFog, k);
        this.nightFactor = 0.45 + k * 0.45;
        cloudColor.set(0xff8550).lerp(new THREE.Color(0x28203b), k);
        starsOpacity = k * 0.8;
        ambientIntensity = 0.35 - k * 0.2;
        moonIntensity = k * 0.25;
      }

      (this.sunMesh.material as THREE.MeshBasicMaterial).color.set(0xff4d17);
      this.sunMesh.scale.set(1.3, 1.3, 1.3);
    } else {
      // DEEP NIGHT / MIDNIGHT (0.60 to 0.90)
      this.timePhase = 'night';
      const nightDepth = 1.0 - Math.abs(t - 0.75) / 0.15;
      this.nightFactor = Math.min(1.0, 0.82 + Math.max(0, nightDepth) * 0.18);

      skyColor.copy(cNightSky);
      fogColor.copy(cNightFog);
      cloudColor.set(0x151d30);
      cloudOpacity = 0.38;
      starsOpacity = 0.85 + Math.sin(Date.now() * 0.003) * 0.12;
      ambientIntensity = 0.13;
      sunIntensity = 0;
      moonIntensity = 0.38;

      (this.moonMesh.material as THREE.MeshBasicMaterial).color.set(0xe8f0fe);
      this.sunMesh.scale.set(1.0, 1.0, 1.0);
    }

    // Apply colors to scene
    (this.skyMesh.material as THREE.MeshBasicMaterial).color.copy(skyColor);
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color.copy(fogColor);
    }
    (this.cloudsMesh.material as THREE.MeshBasicMaterial).color.copy(cloudColor);
    (this.cloudsMesh.material as THREE.MeshBasicMaterial).opacity = cloudOpacity;
    (this.starsMesh.material as THREE.PointsMaterial).opacity = Math.max(0, Math.min(1, starsOpacity));

    this.ambientLight.intensity = ambientIntensity;
    this.sunLight.intensity = sunIntensity;
    this.moonLight.intensity = moonIntensity;

    // Keep sky and stars centered around player
    this.skyMesh.position.copy(this.player.position);
    this.starsMesh.position.copy(this.player.position);
    this.cloudsMesh.position.x = this.player.position.x;
    this.cloudsMesh.position.z = this.player.position.z;
  }

  // Update placed torch lighting across the world dynamically (optimized O(K) with lightSourceBlocks)
  private updateTorchLighting() {
    if (this.lightSourceBlocks.size === 0) {
      for (let i = 0; i < this.placedTorchLights.length; i++) {
        this.placedTorchLights[i].visible = false;
      }
      return;
    }

    const px = this.player.position.x;
    const py = this.player.position.y;
    const pz = this.player.position.z;

    const nearby: { x: number; y: number; z: number; distSq: number }[] = [];
    this.lightSourceBlocks.forEach((key) => {
      const [x, y, z] = key.split(',').map(Number);
      const dx = x - px;
      const dy = y - py;
      const dz = z - pz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < 26 * 26) {
        nearby.push({ x, y, z, distSq });
      }
    });

    nearby.sort((a, b) => a.distSq - b.distSq);

    const time = Date.now() * 0.006;
    for (let i = 0; i < this.placedTorchLights.length; i++) {
      const light = this.placedTorchLights[i];
      if (i < nearby.length) {
        const t = nearby[i];
        light.position.set(t.x, t.y + 0.25, t.z);
        // Dynamic warm flame flicker
        const flicker = 1.9 + Math.sin(time + i * 2.3) * 0.25;
        light.intensity = flicker;
        light.visible = true;
      } else {
        light.intensity = 0;
        light.visible = false;
      }
    }
  }

  // Update particles and mobs
  private updateEntities(dt: number) {
    // 1. Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.velocity.y -= GRAVITY * dt * 0.8;
      p.mesh.position.addScaledVector(p.velocity, dt);

      const scale = Math.max(0, 1 - p.life / p.maxLife);
      p.mesh.scale.set(scale, scale, scale);

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
      }
    }

    // 2. Mobs AI
    this.mobs.forEach((mob) => {
      mob.walkTimer += dt;
      if (mob.walkTimer > 4) {
        mob.walkTimer = 0;
        mob.targetPos.set(
          mob.pos.x + (Math.random() - 0.5) * 8,
          0,
          mob.pos.z + (Math.random() - 0.5) * 8
        );
      }

      const dir = new THREE.Vector3().subVectors(mob.targetPos, mob.pos);
      dir.y = 0;
      if (dir.length() > 0.2) {
        dir.normalize();
        mob.pos.x += dir.x * dt * 1.2;
        mob.pos.z += dir.z * dt * 1.2;

        mob.rotY = Math.atan2(dir.x, dir.z);
        mob.mesh.rotation.y = mob.rotY;

        // Leg swing animation
        const legAngle = Math.sin(Date.now() * 0.008) * 0.4;
        mob.legs[0].rotation.x = legAngle;
        mob.legs[1].rotation.x = -legAngle;
        mob.legs[2].rotation.x = -legAngle;
        mob.legs[3].rotation.x = legAngle;
      }

      // Keep mob on ground
      const groundY = this.findHighestBlock(Math.round(mob.pos.x), Math.round(mob.pos.z));
      mob.pos.y = groundY + 0.5;
      mob.mesh.position.copy(mob.pos);
    });

    // 3. Dragon Boss AI & Projectiles
    if (this.boss && this.boss.isAlive) {
      this.boss.update(dt, this.player.position, (fireball) => {
        this.scene.add(fireball.mesh);
        this.bossFireballs.push(fireball);
      });
    }

    // 4. Boss Fireballs
    for (let i = this.bossFireballs.length - 1; i >= 0; i--) {
      const fb = this.bossFireballs[i];
      fb.life -= dt;
      fb.pos.addScaledVector(fb.velocity, dt);
      fb.mesh.position.copy(fb.pos);

      // Check collision with player
      const d = fb.pos.distanceTo(this.player.position);
      if (d < 1.4) {
        this.damagePlayer(4, 'Ejderha Ateşi Hasarı');
        this.scene.remove(fb.mesh);
        fb.mesh.geometry.dispose();
        this.bossFireballs.splice(i, 1);
        continue;
      }

      if (fb.life <= 0) {
        this.scene.remove(fb.mesh);
        fb.mesh.geometry.dispose();
        this.bossFireballs.splice(i, 1);
      }
    }
  }

  // Animation Loop with Target FPS Lock (Solid 30 FPS / Zero Lag)
  private loop = (time: number) => {
    if (!this.isRunning) return;

    // Enforce target FPS pacing (e.g. 30 FPS saves 50% CPU/GPU and prevents thermal throttling)
    if (this.targetFPS > 0) {
      const minInterval = 1000 / this.targetFPS;
      const elapsed = time - this.lastRenderTime;
      if (elapsed < minInterval - 2) {
        requestAnimationFrame(this.loop);
        return;
      }
      this.lastRenderTime = time - (elapsed % minInterval);
    }

    // Measure live FPS
    this.fpsFrames++;
    if (time - this.fpsLastSampleTime >= 1000) {
      this.currentFPS = Math.round((this.fpsFrames * 1000) / (time - this.fpsLastSampleTime));
      this.fpsFrames = 0;
      this.fpsLastSampleTime = time;
    }

    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    this.updatePlayer(dt);
    this.updateChunkDistanceCulling();
    this.updateRaycast();
    this.updateMining(dt);
    this.updateSkyAndLighting(dt);
    this.updateTorchLighting();
    this.updateEntities(dt);

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  public start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      requestAnimationFrame(this.loop);
      sound.startAmbientMusic();
    }
  }

  public stop() {
    this.isRunning = false;
    sound.stopAmbientMusic();
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.container && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
