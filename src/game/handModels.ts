import * as THREE from 'three';
import { BlockType, BLOCK_DEFS } from './constants';
import { getBlockMaterials, getBlockTextures } from './textures';

// Materials for tools
const woodShaftMat = new THREE.MeshLambertMaterial({ color: 0x6e4a28 });
const woodHeadMat = new THREE.MeshLambertMaterial({ color: 0x9b7145 });
const stoneHeadMat = new THREE.MeshLambertMaterial({ color: 0x7a7a7a });
const copperHeadMat = new THREE.MeshLambertMaterial({ color: 0xc86438 });
const ironHeadMat = new THREE.MeshLambertMaterial({ color: 0xe0e0e0 });
const diamondHeadMat = new THREE.MeshLambertMaterial({ color: 0x4dedf4 });

// Player Steve Arm materials
const steveSleeveMat = new THREE.MeshLambertMaterial({ color: 0x00a8a8 });
const steveSkinMat = new THREE.MeshLambertMaterial({ color: 0xc48a60 });

/**
 * Creates Steve's authentic first-person bare arm
 */
export function createPlayerArmModel(): THREE.Group {
  const group = new THREE.Group();

  // Cyan sleeve
  const sleeveGeom = new THREE.BoxGeometry(0.24, 0.32, 0.24);
  const sleeve = new THREE.Mesh(sleeveGeom, steveSleeveMat);
  sleeve.position.set(0, -0.16, 0);
  group.add(sleeve);

  // Forearm & hand
  const armGeom = new THREE.BoxGeometry(0.22, 0.44, 0.22);
  const arm = new THREE.Mesh(armGeom, steveSkinMat);
  arm.position.set(0, 0.16, 0);
  group.add(arm);

  // Position angled like Minecraft bare hand
  group.position.set(0.35, -0.42, -0.62);
  group.rotation.set(0.35, -0.45, 0.25);
  return group;
}

/**
 * Creates an authentic 3D Minecraft Pickaxe model
 */
export function createPickaxeModel(tier: number, isCopper: boolean = false): THREE.Group {
  const group = new THREE.Group();

  let headMat = woodHeadMat;
  if (isCopper) headMat = copperHeadMat;
  else if (tier === 2) headMat = stoneHeadMat;
  else if (tier === 3) headMat = ironHeadMat;
  else if (tier === 4) headMat = diamondHeadMat;

  // 1. Long wooden stick / handle
  const handleGeom = new THREE.BoxGeometry(0.042, 0.72, 0.042);
  const handle = new THREE.Mesh(handleGeom, woodShaftMat);
  group.add(handle);

  // 2. Pickaxe Head
  // Center bar
  const headBarGeom = new THREE.BoxGeometry(0.42, 0.09, 0.06);
  const headBar = new THREE.Mesh(headBarGeom, headMat);
  headBar.position.set(0, 0.32, 0);
  group.add(headBar);

  // Left curved pick prong
  const leftTipGeom = new THREE.BoxGeometry(0.08, 0.13, 0.06);
  const leftTip = new THREE.Mesh(leftTipGeom, headMat);
  leftTip.position.set(-0.21, 0.25, 0);
  leftTip.rotation.z = 0.2;
  group.add(leftTip);

  // Right curved pick prong
  const rightTipGeom = new THREE.BoxGeometry(0.08, 0.13, 0.06);
  const rightTip = new THREE.Mesh(rightTipGeom, headMat);
  rightTip.position.set(0.21, 0.25, 0);
  rightTip.rotation.z = -0.2;
  group.add(rightTip);

  // Center collar
  const collarGeom = new THREE.BoxGeometry(0.09, 0.09, 0.08);
  const collar = new THREE.Mesh(collarGeom, headMat);
  collar.position.set(0, 0.32, 0);
  group.add(collar);

  // Angle across the lower right screen
  group.position.set(0.38, -0.38, -0.65);
  group.rotation.set(0.45, -0.55, 0.4);
  return group;
}

/**
 * Creates an authentic 3D Minecraft Sword model
 */
export function createSwordModel(tier: number, isCopper: boolean = false): THREE.Group {
  const group = new THREE.Group();

  let bladeMat = woodHeadMat;
  if (isCopper) bladeMat = copperHeadMat;
  else if (tier === 3) bladeMat = ironHeadMat;
  else if (tier === 4) bladeMat = diamondHeadMat;

  // Handle
  const gripGeom = new THREE.BoxGeometry(0.042, 0.22, 0.042);
  const grip = new THREE.Mesh(gripGeom, woodShaftMat);
  grip.position.set(0, -0.22, 0);
  group.add(grip);

  // Pommel
  const pommelGeom = new THREE.BoxGeometry(0.08, 0.04, 0.08);
  const pommel = new THREE.Mesh(pommelGeom, woodShaftMat);
  pommel.position.set(0, -0.34, 0);
  group.add(pommel);

  // Crossguard
  const guardGeom = new THREE.BoxGeometry(0.24, 0.05, 0.06);
  const guard = new THREE.Mesh(guardGeom, woodShaftMat);
  guard.position.set(0, -0.11, 0);
  group.add(guard);

  // Blade
  const bladeGeom = new THREE.BoxGeometry(0.09, 0.72, 0.035);
  const blade = new THREE.Mesh(bladeGeom, bladeMat);
  blade.position.set(0, 0.27, 0);
  group.add(blade);

  // Tip
  const tipGeom = new THREE.ConeGeometry(0.06, 0.1, 4);
  const tip = new THREE.Mesh(tipGeom, bladeMat);
  tip.position.set(0, 0.68, 0);
  tip.rotation.y = Math.PI / 4;
  group.add(tip);

  group.position.set(0.38, -0.36, -0.65);
  group.rotation.set(0.35, -0.5, 0.3);
  return group;
}

/**
 * Creates an authentic 3D Minecraft Axe model
 */
export function createAxeModel(tier: number): THREE.Group {
  const group = new THREE.Group();

  let headMat = woodHeadMat;
  if (tier >= 3) headMat = ironHeadMat;

  // Handle
  const handleGeom = new THREE.BoxGeometry(0.042, 0.72, 0.042);
  const handle = new THREE.Mesh(handleGeom, woodShaftMat);
  group.add(handle);

  // Heavy Axe blade
  const bladeGeom = new THREE.BoxGeometry(0.22, 0.25, 0.06);
  const blade = new THREE.Mesh(bladeGeom, headMat);
  blade.position.set(0.09, 0.24, 0);
  group.add(blade);

  group.position.set(0.38, -0.38, -0.65);
  group.rotation.set(0.45, -0.55, 0.4);
  return group;
}

/**
 * Creates an authentic 3D Torch model with glowing flame
 */
export function createTorchModel(): THREE.Group {
  const group = new THREE.Group();

  // Stick
  const stickGeom = new THREE.BoxGeometry(0.05, 0.48, 0.05);
  const stick = new THREE.Mesh(stickGeom, woodShaftMat);
  group.add(stick);

  // Glowing flame head
  const flameGeom = new THREE.BoxGeometry(0.08, 0.1, 0.08);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa22 });
  const flame = new THREE.Mesh(flameGeom, flameMat);
  flame.position.set(0, 0.25, 0);
  group.add(flame);

  group.position.set(0.35, -0.38, -0.62);
  group.rotation.set(0.2, -0.4, 0.15);
  return group;
}

/**
 * Creates a 3D isometric mini-cube for standard blocks
 */
export function createBlockHeldModel(blockType: BlockType): THREE.Group {
  const group = new THREE.Group();
  const boxGeom = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const materials = getBlockMaterials(blockType);
  const mesh = new THREE.Mesh(boxGeom, materials);
  group.add(mesh);

  group.position.set(0.38, -0.38, -0.65);
  group.rotation.set(-0.1, -0.55, 0.2);
  return group;
}

/**
 * Creates a tilted sprite badge for items & food (Apple, Bread, Meat, Stick, Wheat)
 */
export function createItemSpriteHeldModel(blockType: BlockType): THREE.Group {
  const group = new THREE.Group();
  const { side } = getBlockTextures(blockType);

  const mat = new THREE.MeshLambertMaterial({
    map: side,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });

  const plateGeom = new THREE.BoxGeometry(0.36, 0.36, 0.03);
  const mesh = new THREE.Mesh(plateGeom, mat);
  group.add(mesh);

  group.position.set(0.38, -0.38, -0.62);
  group.rotation.set(0.25, -0.5, 0.25);
  return group;
}

/**
 * Factory function to build the correct 3D first-person held item model
 */
export function createHeldModelForType(blockType: BlockType): THREE.Group {
  if (blockType === BlockType.AIR) {
    return createPlayerArmModel();
  }

  const def = BLOCK_DEFS[blockType];

  if (def?.isTool) {
    const tier = def.toolTier || 1;
    if (def.toolType === 'pickaxe') {
      return createPickaxeModel(tier, blockType === BlockType.COPPER_PICKAXE);
    }
    if (def.toolType === 'sword') {
      return createSwordModel(tier, blockType === BlockType.COPPER_SWORD);
    }
    if (def.toolType === 'axe') {
      return createAxeModel(tier);
    }
    // Armors
    return createItemSpriteHeldModel(blockType);
  }

  if (blockType === BlockType.TORCH) {
    return createTorchModel();
  }

  if (
    def?.isFood ||
    blockType === BlockType.STICK ||
    blockType === BlockType.WHEAT ||
    blockType === BlockType.COPPER_INGOT ||
    blockType === BlockType.IRON_BARS
  ) {
    return createItemSpriteHeldModel(blockType);
  }

  // All other placeable 3D blocks (Grass, Wood, Planks, Stone, Diamond Ore, Bookshelf, etc.)
  return createBlockHeldModel(blockType);
}

/**
 * Creates an authentic 3D Minecraft Shield model for Off-Hand
 */
export function createShieldModel(): THREE.Group {
  const group = new THREE.Group();
  const rimMat = new THREE.MeshLambertMaterial({ color: 0xdfdfdf });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a5d30 });
  const bossMat = new THREE.MeshLambertMaterial({ color: 0x444444 });

  // Main wooden body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.52, 0.04), woodMat);
  group.add(body);

  // Iron border
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.54, 0.025), rimMat);
  rim.position.z = 0.01;
  group.add(rim);

  // Center iron boss
  const boss = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), bossMat);
  boss.position.z = 0.03;
  group.add(boss);

  group.position.set(-0.4, -0.32, -0.6);
  group.rotation.set(0.2, 0.45, -0.15);
  return group;
}

/**
 * Creates an authentic 3D Torch model held in the left hand (Sol El)
 */
export function createLeftTorchModel(): THREE.Group {
  const group = new THREE.Group();

  // Stick
  const stickGeom = new THREE.BoxGeometry(0.05, 0.48, 0.05);
  const stick = new THREE.Mesh(stickGeom, woodShaftMat);
  group.add(stick);

  // Glowing flame head with intense emissive shine
  const flameGeom = new THREE.BoxGeometry(0.09, 0.12, 0.09);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa11 });
  const flame = new THREE.Mesh(flameGeom, flameMat);
  flame.position.set(0, 0.25, 0);
  group.add(flame);

  group.position.set(-0.36, -0.36, -0.62);
  group.rotation.set(0.2, 0.4, -0.15);
  return group;
}

/**
 * Creates the model for items held in the Left Hand (Off-Hand / Sol El)
 */
export function createLeftHeldModelForType(blockType: BlockType): THREE.Group {
  const group = new THREE.Group();
  if (blockType === BlockType.AIR) {
    return group; // Hidden when nothing in offhand
  }

  if (blockType === BlockType.SHIELD) {
    return createShieldModel();
  }

  if (blockType === BlockType.TORCH) {
    return createLeftTorchModel();
  }

  const def = BLOCK_DEFS[blockType];
  if (def?.isTool || def?.isArmor || def?.isFood || blockType === BlockType.DIAMOND) {
    const itemModel = createItemSpriteHeldModel(blockType);
    itemModel.position.set(-0.36, -0.36, -0.62);
    itemModel.rotation.set(0.25, 0.5, -0.25);
    return itemModel;
  }

  // Standard block in left hand
  const blockModel = createBlockHeldModel(blockType);
  blockModel.position.set(-0.36, -0.36, -0.62);
  blockModel.rotation.set(-0.1, 0.55, -0.2);
  return blockModel;
}

