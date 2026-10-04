import {
  BlockType,
  WORLD_SIZE_X,
  WORLD_SIZE_Z,
  WATER_LEVEL,
} from './constants';

export let STRONGHOLD_POS = { x: 30, z: 30, y: 7 };

// Pseudo-random Perlin-like noise generator
class Perlin2D {
  private p: number[] = [];

  constructor(seed: number = 42) {
    const permutation: number[] = [];
    for (let i = 0; i < 256; i++) permutation[i] = i;
    // Shuffle with seed
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = Math.floor((s / 2147483647) * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    this.p = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i & 255];
    }
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const A = this.p[X] + Y;
    const B = this.p[X + 1] + Y;

    return this.lerp(
      v,
      this.lerp(u, this.grad(this.p[A], xf, yf), this.grad(this.p[B], xf - 1, yf)),
      this.lerp(
        u,
        this.grad(this.p[A + 1], xf, yf - 1),
        this.grad(this.p[B + 1], xf - 1, yf - 1)
      )
    );
  }

  public octave(x: number, y: number, octaves: number = 4, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  }
}

export function generateWorld(seed: number = Math.floor(Math.random() * 100000)): Map<string, BlockType> {
  const blocks = new Map<string, BlockType>();
  const perlin = new Perlin2D(seed);

  // Compute a randomized Stronghold location for this world (between 24 and 46 blocks from spawn)
  const angle = (seed % 628) / 100;
  const dist = 26 + ((seed * 37) % 20);
  const shX = Math.round(Math.cos(angle) * dist);
  const shZ = Math.round(Math.sin(angle) * dist);
  STRONGHOLD_POS = { x: shX, z: shZ, y: 7 };

  const tempNoise = new Perlin2D(seed + 101);
  const moistureNoise = new Perlin2D(seed + 202);

  const setBlock = (x: number, y: number, z: number, type: BlockType) => {
    if (type === BlockType.AIR) {
      blocks.delete(`${x},${y},${z}`);
    } else {
      blocks.set(`${x},${y},${z}`, type);
    }
  };

  const halfX = Math.floor(WORLD_SIZE_X / 2);
  const halfZ = Math.floor(WORLD_SIZE_Z / 2);

  // Generate terrain height map and determine biomes
  const heightMap: number[][] = [];
  const biomeMap: ('snow' | 'desert' | 'plains' | 'forest')[][] = [];

  for (let x = -halfX; x <= halfX; x++) {
    heightMap[x] = [];
    biomeMap[x] = [];
    for (let z = -halfZ; z <= halfZ; z++) {
      // Noise coordinates
      const nx = (x + halfX) * 0.048;
      const nz = (z + halfZ) * 0.048;
      const elev = perlin.octave(nx, nz, 3, 0.45); // -1 to 1

      // Map to height: 13 to 24
      const h = Math.floor(16 + elev * 7);
      heightMap[x][z] = h;

      // Biome noise: temperature & moisture
      const temp = tempNoise.noise((x + halfX) * 0.022, (z + halfZ) * 0.022);
      const moist = moistureNoise.noise((x + halfX) * 0.025, (z + halfZ) * 0.025);

      if (temp < -0.18) {
        biomeMap[x][z] = 'snow';
      } else if (temp > 0.22 && moist < 0.05) {
        biomeMap[x][z] = 'desert';
      } else if (moist > 0.2) {
        biomeMap[x][z] = 'forest';
      } else {
        biomeMap[x][z] = 'plains';
      }
    }
  }

  // Populate blocks layer by layer with authentic biomes
  for (let x = -halfX; x <= halfX; x++) {
    for (let z = -halfZ; z <= halfZ; z++) {
      const surfaceY = heightMap[x][z];
      const biome = biomeMap[x][z];

      // Bedrock at y = 0
      setBlock(x, 0, z, BlockType.BEDROCK);

      // Fill from y = 1 to surfaceY
      for (let y = 1; y <= surfaceY; y++) {
        if (y === surfaceY) {
          // Top layer based on Biome
          if (surfaceY <= WATER_LEVEL + 1) {
            setBlock(x, y, z, BlockType.SAND);
          } else if (biome === 'snow') {
            setBlock(x, y, z, BlockType.SNOW);
          } else if (biome === 'desert') {
            setBlock(x, y, z, BlockType.SAND);
          } else {
            setBlock(x, y, z, BlockType.GRASS);
          }
        } else if (y >= surfaceY - 3) {
          // Subsurface layer
          if (surfaceY <= WATER_LEVEL + 1) {
            setBlock(x, y, z, BlockType.SAND);
          } else if (biome === 'desert') {
            setBlock(x, y, z, BlockType.SAND);
          } else if (biome === 'snow') {
            setBlock(x, y, z, BlockType.DIRT);
          } else {
            setBlock(x, y, z, BlockType.DIRT);
          }
        } else if (biome === 'desert' && y >= surfaceY - 6) {
          // Sandstone layer beneath desert sand
          setBlock(x, y, z, BlockType.SANDSTONE);
        } else if (y <= 13) {
          // DEEPSLATE LAYER (y = 1 to 13) - Derin Kaynak Taşı & Derin Cevherler!
          const oreRoll = Math.random();
          if (y < 5 && oreRoll < 0.04) {
            setBlock(x, y, z, BlockType.DEEPSLATE_DIAMOND_ORE);
          } else if (y < 8 && oreRoll < 0.055) {
            setBlock(x, y, z, BlockType.DEEPSLATE_GOLD_ORE);
          } else if (y < 12 && oreRoll < 0.08) {
            setBlock(x, y, z, BlockType.DEEPSLATE_IRON_ORE);
          } else if (oreRoll < 0.065) {
            setBlock(x, y, z, BlockType.DEEPSLATE_COPPER_ORE);
          } else if (oreRoll < 0.11) {
            setBlock(x, y, z, BlockType.DEEPSLATE_COAL_ORE);
          } else {
            setBlock(x, y, z, BlockType.DEEPSLATE);
          }
        } else {
          // STONE LAYER (y = 14 to surface - 4) with ores
          const oreRoll = Math.random();
          if (y < 16 && oreRoll < 0.03) {
            setBlock(x, y, z, BlockType.DIAMOND_ORE);
          } else if (y < 18 && oreRoll < 0.045) {
            setBlock(x, y, z, BlockType.GOLD_ORE);
          } else if (oreRoll < 0.07) {
            setBlock(x, y, z, BlockType.COPPER_ORE);
          } else if (oreRoll < 0.09) {
            setBlock(x, y, z, BlockType.IRON_ORE);
          } else if (oreRoll < 0.13) {
            setBlock(x, y, z, BlockType.COAL_ORE);
          } else {
            setBlock(x, y, z, BlockType.STONE);
          }
        }
      }

      // Fill water or ice up to WATER_LEVEL
      if (surfaceY < WATER_LEVEL) {
        for (let y = surfaceY + 1; y <= WATER_LEVEL; y++) {
          if (biome === 'snow' && y === WATER_LEVEL) {
            // Ice on top of frozen water in snow biome!
            setBlock(x, y, z, BlockType.ICE);
          } else {
            setBlock(x, y, z, BlockType.WATER);
          }
        }
      }
    }
  }

  // Plant flora naturally: Reduced trees (user requested) + Cacti in Desert
  const vegetationPositions: [number, number, number][] = [];
  for (let x = -halfX + 3; x <= halfX - 3; x++) {
    for (let z = -halfZ + 3; z <= halfZ - 3; z++) {
      // Don't plant right on top of stronghold beacon
      if (Math.hypot(x - STRONGHOLD_POS.x, z - STRONGHOLD_POS.z) < 6) continue;

      const surfaceY = heightMap[x][z];
      if (surfaceY <= WATER_LEVEL + 1) continue;

      const biome = biomeMap[x][z];

      // Desert: Cacti instead of heavy leafy trees
      if (biome === 'desert') {
        if (Math.random() < 0.02) {
          const tooClose = vegetationPositions.some(
            ([tx, , tz]) => Math.hypot(tx - x, tz - z) < 4
          );
          if (!tooClose) {
            vegetationPositions.push([x, surfaceY, z]);
            const cactusH = 2 + Math.floor(Math.random() * 2); // 2-3 blocks tall
            for (let cy = 1; cy <= cactusH; cy++) {
              setBlock(x, surfaceY + cy, z, BlockType.CACTUS);
            }
          }
        }
        continue;
      }

      // Snow biome: Very rare pine trees
      if (biome === 'snow') {
        if (Math.random() < 0.012) {
          const tooClose = vegetationPositions.some(
            ([tx, , tz]) => Math.hypot(tx - x, tz - z) < 6
          );
          if (!tooClose) {
            vegetationPositions.push([x, surfaceY, z]);
            growTree(blocks, x, surfaceY + 1, z, true);
          }
        }
        continue;
      }

      // Plains: Rare solitary trees ("ağaçlar üstüne biraz azalt")
      if (biome === 'plains') {
        if (Math.random() < 0.008) {
          const tooClose = vegetationPositions.some(
            ([tx, , tz]) => Math.hypot(tx - x, tz - z) < 7
          );
          if (!tooClose) {
            vegetationPositions.push([x, surfaceY, z]);
            growTree(blocks, x, surfaceY + 1, z, false);
          }
        }
        continue;
      }

      // Forest: Moderate trees (spacious, reduced density for high FPS)
      if (biome === 'forest') {
        if (Math.random() < 0.022) {
          const tooClose = vegetationPositions.some(
            ([tx, , tz]) => Math.hypot(tx - x, tz - z) < 5
          );
          if (!tooClose) {
            vegetationPositions.push([x, surfaceY, z]);
            growTree(blocks, x, surfaceY + 1, z, false);
          }
        }
      }
    }
  }

  // =========================================================================
  // 1. SKY GLASS BEACON TOWER (Camdan yukarı uzanan kule)
  // =========================================================================
  const towerX = STRONGHOLD_POS.x;
  const towerZ = STRONGHOLD_POS.z;
  const towerBaseY = heightMap[towerX]?.[towerZ] || 18;
  const towerTopY = 46;

  for (let y = towerBaseY; y <= towerTopY; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const isCenter = dx === 0 && dz === 0;
        if (isCenter) {
          // Central luminous beacon ray
          setBlock(towerX + dx, y, towerZ + dz, BlockType.GLOWSTONE);
        } else {
          // Glass casing
          setBlock(towerX + dx, y, towerZ + dz, BlockType.GLASS);
        }
      }
    }
  }

  // =========================================================================
  // 2. SUBTERRANEAN STRONGHOLD & END PORTAL ROOM (Yeraltı Kalesi & Portal)
  // =========================================================================
  // Located underground directly below the Glass Tower between y = 4 and y = 11
  // shX and shZ are already calculated above (STRONGHOLD_POS.x, STRONGHOLD_POS.z)

  // Carve 11x11 stronghold chamber
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -5; dz <= 5; dz++) {
      for (let y = 3; y <= 11; y++) {
        const isFloor = y === 3;
        const isCeiling = y === 11;
        const isWall = Math.abs(dx) === 5 || Math.abs(dz) === 5;

        if (isFloor || isCeiling) {
          // Floor and ceiling stone bricks
          const r = Math.random();
          const brickType = r < 0.2 ? BlockType.MOSSY_STONE_BRICKS : r < 0.4 ? BlockType.CRACKED_STONE_BRICKS : BlockType.STONE_BRICKS;
          setBlock(shX + dx, y, shZ + dz, brickType);
        } else if (isWall) {
          // Wall with iron bars slits
          const isWindow = (Math.abs(dx) === 0 && Math.abs(dz) === 5 && y >= 6 && y <= 8) ||
                           (Math.abs(dz) === 0 && Math.abs(dx) === 5 && y >= 6 && y <= 8);
          if (isWindow) {
            setBlock(shX + dx, y, shZ + dz, BlockType.IRON_BARS);
          } else {
            const r = Math.random();
            const brickType = r < 0.2 ? BlockType.MOSSY_STONE_BRICKS : r < 0.35 ? BlockType.CRACKED_STONE_BRICKS : BlockType.STONE_BRICKS;
            setBlock(shX + dx, y, shZ + dz, brickType);
          }
        } else {
          // Inside chamber air
          setBlock(shX + dx, y, shZ + dz, BlockType.AIR);
        }
      }
    }
  }

  // Library / bookshelves corners
  setBlock(shX - 4, 4, shZ - 4, BlockType.BOOKSHELF);
  setBlock(shX - 4, 5, shZ - 4, BlockType.BOOKSHELF);
  setBlock(shX - 3, 4, shZ - 4, BlockType.BOOKSHELF);
  setBlock(shX - 4, 4, shZ - 3, BlockType.BOOKSHELF);
  setBlock(shX + 4, 4, shZ - 4, BlockType.BOOKSHELF);
  setBlock(shX + 4, 5, shZ - 4, BlockType.BOOKSHELF);
  setBlock(shX + 3, 4, shZ - 4, BlockType.BOOKSHELF);
  setBlock(shX + 4, 4, shZ - 3, BlockType.BOOKSHELF);

  // Torches on walls
  setBlock(shX - 4, 6, shZ, BlockType.TORCH);
  setBlock(shX + 4, 6, shZ, BlockType.TORCH);
  setBlock(shX, 6, shZ - 4, BlockType.TORCH);
  setBlock(shX, 6, shZ + 4, BlockType.TORCH);

  // =========================================================================
  // Authentic Minecraft 3x3 End Portal Room (3x3 Portal Havuzu & 12 Çerçeve)
  // =========================================================================
  // Pedestal stone bricks at y = 3 and y = 4
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      setBlock(shX + dx, 3, shZ + dz, BlockType.STONE_BRICKS);
      if (Math.abs(dx) >= 2 || Math.abs(dz) >= 2) {
        setBlock(shX + dx, 4, shZ + dz, BlockType.STONE_BRICKS);
      }
    }
  }

  // 3x3 Molten energy pool beneath the 3x3 portal at y = 4
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      setBlock(shX + dx, 4, shZ + dz, BlockType.GLOWSTONE);
    }
  }

  // 12 End Portal Frames surrounding the 3x3 portal pool at y = 5
  // (3 North, 3 South, 3 West, 3 East with empty corners)
  const frameOffsets = [
    // North (3 frames)
    [-1, -2], [0, -2], [1, -2],
    // South (3 frames)
    [-1,  2], [0,  2], [1,  2],
    // West (3 frames)
    [-2, -1], [-2,  0], [-2,  1],
    // East (3 frames)
    [ 2, -1], [ 2,  0], [ 2,  1],
  ];

  frameOffsets.forEach(([dx, dz]) => {
    setBlock(shX + dx, 5, shZ + dz, BlockType.END_PORTAL_FRAME);
  });

  // 3x3 portal center pool at y = 5 (Air initially; becomes 3x3 END_PORTAL when activated!)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      setBlock(shX + dx, 5, shZ + dz, BlockType.AIR);
    }
  }

  return blocks;
}

// Grow a tree at (x, startY, z) - optimized foliage to reduce block count
export function growTree(
  blocks: Map<string, BlockType>,
  x: number,
  startY: number,
  z: number,
  isSnowTree: boolean = false
) {
  const trunkHeight = isSnowTree ? 5 : 4;

  // Trunk
  for (let dy = 0; dy < trunkHeight; dy++) {
    blocks.set(`${x},${startY + dy},${z}`, BlockType.OAK_WOOD);
  }

  // Leaves canopy (streamlined for performance and aesthetics)
  const topY = startY + trunkHeight;
  for (let dy = -2; dy <= 1; dy++) {
    const ly = topY + dy;
    const radius = dy === 1 ? 1 : 2;

    for (let lx = -radius; lx <= radius; lx++) {
      for (let lz = -radius; lz <= radius; lz++) {
        // Prune corners to give a round natural Minecraft shape with fewer blocks
        if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) {
          continue;
        }
        const key = `${x + lx},${ly},${z + lz}`;
        if (!blocks.has(key) || blocks.get(key) === BlockType.AIR) {
          blocks.set(key, BlockType.LEAVES);
          if (isSnowTree && dy === 1) {
            blocks.set(`${x + lx},${ly + 1},${z + lz}`, BlockType.SNOW);
          }
        }
      }
    }
  }
}

// Prefabricated instant structures
export function buildStructure(
  blocks: Map<string, BlockType>,
  type: 'house' | 'tower' | 'portal' | 'tree',
  targetX: number,
  targetY: number,
  targetZ: number
) {
  const setB = (dx: number, dy: number, dz: number, block: BlockType) => {
    blocks.set(`${targetX + dx},${targetY + dy},${targetZ + dz}`, block);
  };

  if (type === 'house') {
    // 5x5 Cozy Wooden Cottage with glass, torches, door
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        // Cobblestone foundation
        setB(x, 0, z, BlockType.COBBLESTONE);

        // Walls
        for (let y = 1; y <= 3; y++) {
          const isBorder = Math.abs(x) === 2 || Math.abs(z) === 2;
          const isDoorway = x === 0 && z === 2 && y <= 2;
          const isWindow = (x === 0 && Math.abs(z) === 2 && y === 2) || (z === 0 && Math.abs(x) === 2 && y === 2);

          if (isDoorway) {
            setB(x, y, z, BlockType.AIR);
          } else if (isWindow) {
            setB(x, y, z, BlockType.GLASS);
          } else if (isBorder) {
            const isCorner = Math.abs(x) === 2 && Math.abs(z) === 2;
            setB(x, y, z, isCorner ? BlockType.OAK_WOOD : BlockType.OAK_PLANKS);
          } else {
            setB(x, y, z, BlockType.AIR); // interior air
          }
        }

        // Roof
        setB(x, 4, z, BlockType.COBBLESTONE);
      }
    }
    // Interior furniture
    setB(-1, 1, -1, BlockType.CRAFTING_TABLE);
    setB(1, 1, -1, BlockType.BOOKSHELF);
    setB(0, 3, 0, BlockType.GLOWSTONE); // ceiling lamp
  } else if (type === 'tower') {
    // Medieval Stone Watchtower
    for (let y = 0; y <= 8; y++) {
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          const isBorder = Math.abs(x) === 1 || Math.abs(z) === 1;
          if (y === 0) {
            setB(x, y, z, BlockType.COBBLESTONE);
          } else if (y === 8) {
            // Battlements on top
            if (isBorder && (x === 0 || z === 0)) {
              setB(x, y, z, BlockType.COBBLESTONE);
            }
          } else if (isBorder) {
            // Arrow slits
            if (y % 3 === 0 && (x === 0 || z === 0)) {
              setB(x, y, z, BlockType.GLASS);
            } else {
              setB(x, y, z, BlockType.COBBLESTONE);
            }
          } else {
            // Inside ladder area
            setB(x, y, z, BlockType.AIR);
          }
        }
      }
    }
    setB(0, 1, 0, BlockType.GLOWSTONE);
    setB(0, 7, 0, BlockType.GLOWSTONE);
  } else if (type === 'portal') {
    // 4 wide, 5 high Nether Portal frame made of obsidian
    for (let x = -1; x <= 2; x++) {
      for (let y = 0; y <= 4; y++) {
        const isFrame = x === -1 || x === 2 || y === 0 || y === 4;
        if (isFrame) {
          setB(x, y, 0, BlockType.OBSIDIAN);
        } else {
          // Inside purple glowing energy
          setB(x, y, 0, BlockType.WATER); // shimmering purple/blue placeholder
        }
      }
    }
  } else if (type === 'tree') {
    growTree(blocks, targetX, targetY, targetZ);
  }
}
