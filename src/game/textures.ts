import * as THREE from 'three';
import { BlockType } from './constants';

// Cache generated textures so we don't recreate them
const textureCache = new Map<string, THREE.CanvasTexture>();

function createPixelCanvas(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural random noise helper for textures
function noise(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

export function getBlockTextures(blockType: BlockType): {
  top?: THREE.CanvasTexture;
  bottom?: THREE.CanvasTexture;
  side: THREE.CanvasTexture;
} {
  const cacheKey = `block_${blockType}`;
  if (textureCache.has(cacheKey)) {
    const side = textureCache.get(cacheKey)!;
    const top = textureCache.get(`${cacheKey}_top`);
    const bottom = textureCache.get(`${cacheKey}_bottom`);
    return { side, top, bottom };
  }

  let sideTex: THREE.CanvasTexture;
  let topTex: THREE.CanvasTexture | undefined;
  let bottomTex: THREE.CanvasTexture | undefined;

  switch (blockType) {
    case BlockType.GRASS: {
      // Top: rich lush green
      topTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 1);
            if (v < 0.2) ctx.fillStyle = '#4c782b';
            else if (v < 0.5) ctx.fillStyle = '#5b8e34';
            else if (v < 0.8) ctx.fillStyle = '#6da33e';
            else ctx.fillStyle = '#7ebd48';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });

      // Bottom: dirt
      bottomTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 2);
            if (v < 0.3) ctx.fillStyle = '#6f4e37';
            else if (v < 0.6) ctx.fillStyle = '#866043';
            else ctx.fillStyle = '#9b7151';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });

      // Side: dirt with dripping grass overhang
      sideTex = createPixelCanvas((ctx) => {
        // First fill dirt
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 3);
            ctx.fillStyle = v < 0.3 ? '#6f4e37' : v < 0.6 ? '#866043' : '#9b7151';
            ctx.fillRect(x, y, 1, 1);
          }
        }
        // Grass top overhang
        for (let x = 0; x < 16; x++) {
          const depth = 3 + Math.floor(noise(x, 0, 4) * 3);
          for (let y = 0; y < depth; y++) {
            const v = noise(x, y, 5);
            ctx.fillStyle = v < 0.4 ? '#4c782b' : '#6da33e';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.DIRT: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 6);
            if (v < 0.25) ctx.fillStyle = '#654321';
            else if (v < 0.55) ctx.fillStyle = '#866043';
            else if (v < 0.85) ctx.fillStyle = '#9b7151';
            else ctx.fillStyle = '#b0825e';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.STONE: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 7);
            if (v < 0.2) ctx.fillStyle = '#5c5c5c';
            else if (v < 0.5) ctx.fillStyle = '#6e6e6e';
            else if (v < 0.8) ctx.fillStyle = '#7d7d7d';
            else ctx.fillStyle = '#8f8f8f';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.COBBLESTONE: {
      sideTex = createPixelCanvas((ctx) => {
        // Base dark mortar
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, 16, 16);
        // Irregular stones
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const isBorder = (x % 4 === 0 && y % 3 === 0) || (x === 0 || y === 0 || x === 15 || y === 15);
            if (!isBorder) {
              const v = noise(x, y, 8);
              ctx.fillStyle = v < 0.3 ? '#555555' : v < 0.7 ? '#6d6d6d' : '#888888';
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      });
      break;
    }

    case BlockType.OAK_WOOD: {
      // Top rings
      topTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#b38856';
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#593e24';
        // Bark border
        ctx.strokeRect(0.5, 0.5, 15, 15);
        ctx.fillStyle = '#8f683a';
        ctx.fillRect(4, 4, 8, 8);
        ctx.fillStyle = '#674a2b';
        ctx.fillRect(7, 7, 2, 2);
      });
      bottomTex = topTex;

      // Side vertical bark
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x * 3, y * 0.5, 9);
            ctx.fillStyle = v < 0.3 ? '#4d3319' : v < 0.65 ? '#674a2b' : '#7b5a35';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.OAK_PLANKS: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#9b7145';
        ctx.fillRect(0, 0, 16, 16);
        // Horizontal plank divides
        for (let p = 0; p < 4; p++) {
          const y = p * 4;
          ctx.fillStyle = '#5a3d21';
          ctx.fillRect(0, y, 16, 1);
          // Nail specks
          ctx.fillStyle = '#3a2411';
          ctx.fillRect(1, y + 2, 1, 1);
          ctx.fillRect(14, y + 2, 1, 1);
        }
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            if (noise(x, y, 10) > 0.65 && y % 4 !== 0) {
              ctx.fillStyle = '#aa8051';
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      });
      break;
    }

    case BlockType.LEAVES: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#2d5e1e';
        ctx.fillRect(0, 0, 16, 16);
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 11);
            if (v < 0.25) ctx.fillStyle = '#1c3e11';
            else if (v < 0.6) ctx.fillStyle = '#357224';
            else if (v < 0.85) ctx.fillStyle = '#489632';
            else ctx.fillStyle = '#1a3310';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.SAND: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 12);
            if (v < 0.2) ctx.fillStyle = '#c7b97e';
            else if (v < 0.6) ctx.fillStyle = '#d6c88f';
            else if (v < 0.85) ctx.fillStyle = '#dfd39f';
            else ctx.fillStyle = '#eae0b5';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.WATER: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 13);
            ctx.fillStyle = v < 0.3 ? '#295ec2' : v < 0.7 ? '#3b74dc' : '#4d87f0';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.GLASS: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = 'rgba(210, 240, 255, 0.25)';
        ctx.fillRect(0, 0, 16, 16);
        // Border
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.strokeRect(0.5, 0.5, 15, 15);
        // Glint lines
        ctx.fillRect(3, 3, 2, 2);
        ctx.fillRect(5, 5, 2, 2);
        ctx.fillRect(11, 11, 3, 2);
      });
      break;
    }

    case BlockType.BRICKS: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#c0b4aa'; // mortar
        ctx.fillRect(0, 0, 16, 16);
        // rows of red bricks
        for (let row = 0; row < 4; row++) {
          const y = row * 4 + 1;
          const offset = (row % 2) * 4;
          for (let b = 0; b < 3; b++) {
            const x = (b * 7 + offset) % 16;
            ctx.fillStyle = '#9b4632';
            ctx.fillRect(x, y, 6, 3);
            ctx.fillStyle = '#823725';
            ctx.fillRect(x, y + 2, 6, 1);
          }
        }
      });
      break;
    }

    case BlockType.BOOKSHELF: {
      topTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#9b7145';
        ctx.fillRect(0, 0, 16, 16);
      });
      bottomTex = topTex;
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#7a532f'; // wood frame
        ctx.fillRect(0, 0, 16, 16);
        // shelves
        ctx.fillStyle = '#55371c';
        ctx.fillRect(1, 1, 14, 6);
        ctx.fillRect(1, 9, 14, 6);
        // colorful books
        const colors = ['#a02525', '#254fa0', '#25a043', '#c49a25', '#8425a0', '#2599a0'];
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(2 + i * 2.5, 2, 2, 5);
          ctx.fillStyle = colors[(i + 3) % colors.length];
          ctx.fillRect(2 + i * 2.5, 10, 2, 5);
        }
      });
      break;
    }

    case BlockType.GLOWSTONE: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 14);
            if (v < 0.25) ctx.fillStyle = '#a67b2d';
            else if (v < 0.5) ctx.fillStyle = '#dca738';
            else if (v < 0.8) ctx.fillStyle = '#fce268';
            else ctx.fillStyle = '#fff4a8';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.DIAMOND_ORE: {
      sideTex = createPixelCanvas((ctx) => {
        // Base stone
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 15);
            ctx.fillStyle = v < 0.5 ? '#6e6e6e' : '#7d7d7d';
            ctx.fillRect(x, y, 1, 1);
          }
        }
        // Diamond crystals
        const gems = [
          [3, 4], [4, 4], [4, 5],
          [9, 10], [10, 10], [10, 11],
          [12, 3], [13, 3],
          [5, 12], [6, 12],
        ];
        gems.forEach(([gx, gy]) => {
          ctx.fillStyle = '#4dedf4';
          ctx.fillRect(gx, gy, 1, 1);
          ctx.fillStyle = '#bdfaff';
          ctx.fillRect(gx + 1, gy, 1, 1);
        });
      });
      break;
    }

    case BlockType.GOLD_ORE: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 16);
            ctx.fillStyle = v < 0.5 ? '#6e6e6e' : '#7d7d7d';
            ctx.fillRect(x, y, 1, 1);
          }
        }
        const spots = [[3, 3], [4, 4], [10, 8], [11, 9], [6, 12], [12, 4]];
        spots.forEach(([sx, sy]) => {
          ctx.fillStyle = '#fcee4b';
          ctx.fillRect(sx, sy, 2, 1);
          ctx.fillStyle = '#d4aa1e';
          ctx.fillRect(sx, sy + 1, 1, 1);
        });
      });
      break;
    }

    case BlockType.IRON_ORE: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 17);
            ctx.fillStyle = v < 0.5 ? '#6e6e6e' : '#7d7d7d';
            ctx.fillRect(x, y, 1, 1);
          }
        }
        const spots = [[2, 5], [3, 6], [8, 3], [9, 4], [7, 10], [12, 11]];
        spots.forEach(([sx, sy]) => {
          ctx.fillStyle = '#d8af93';
          ctx.fillRect(sx, sy, 2, 1);
          ctx.fillStyle = '#b6896e';
          ctx.fillRect(sx + 1, sy + 1, 1, 1);
        });
      });
      break;
    }

    case BlockType.COAL_ORE: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 18);
            ctx.fillStyle = v < 0.5 ? '#6e6e6e' : '#7d7d7d';
            ctx.fillRect(x, y, 1, 1);
          }
        }
        const spots = [[3, 3], [4, 3], [4, 4], [9, 7], [10, 8], [6, 11], [11, 3]];
        spots.forEach(([sx, sy]) => {
          ctx.fillStyle = '#222222';
          ctx.fillRect(sx, sy, 2, 2);
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(sx, sy, 1, 1);
        });
      });
      break;
    }

    case BlockType.OBSIDIAN: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 19);
            if (v < 0.3) ctx.fillStyle = '#100b1a';
            else if (v < 0.7) ctx.fillStyle = '#1e142e';
            else ctx.fillStyle = '#382559';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.TNT: {
      topTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#9b2b1e';
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#383838';
        ctx.fillRect(7, 7, 2, 2); // fuse
      });
      bottomTex = topTex;
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#db3725'; // red dynamite sticks
        ctx.fillRect(0, 0, 16, 16);
        // white center banner
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 5, 16, 6);
        // "TNT" blocky text
        ctx.fillStyle = '#111111';
        // T
        ctx.fillRect(2, 6, 3, 1);
        ctx.fillRect(3, 7, 1, 3);
        // N
        ctx.fillRect(6, 6, 1, 4);
        ctx.fillRect(7, 7, 1, 1);
        ctx.fillRect(8, 8, 1, 1);
        ctx.fillRect(9, 6, 1, 4);
        // T
        ctx.fillRect(11, 6, 3, 1);
        ctx.fillRect(12, 7, 1, 3);
      });
      break;
    }

    case BlockType.CRAFTING_TABLE: {
      topTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#8f6534';
        ctx.fillRect(0, 0, 16, 16);
        // 3x3 grid
        ctx.fillStyle = '#553c1e';
        for (let i = 1; i <= 3; i++) {
          ctx.fillRect(i * 4, 1, 1, 14);
          ctx.fillRect(1, i * 4, 14, 1);
        }
      });
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#9b7145';
        ctx.fillRect(0, 0, 16, 16);
        // Tool outlines on side
        ctx.fillStyle = '#442d17';
        ctx.fillRect(3, 3, 2, 8); // handle
        ctx.fillRect(2, 3, 4, 2); // hammer head
        ctx.fillRect(9, 5, 4, 6); // saw blade
      });
      break;
    }

    case BlockType.BEDROCK: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 20);
            if (v < 0.25) ctx.fillStyle = '#111111';
            else if (v < 0.55) ctx.fillStyle = '#2b2b2b';
            else if (v < 0.85) ctx.fillStyle = '#444444';
            else ctx.fillStyle = '#5c5c5c';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.SNOW: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 21);
            ctx.fillStyle = v < 0.3 ? '#e0ecf7' : v < 0.7 ? '#edf4fb' : '#ffffff';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.ICE: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 71);
            ctx.fillStyle = v < 0.3 ? '#8cd1ed' : v < 0.7 ? '#a8e1f5' : '#c3effc';
            ctx.fillRect(x, y, 1, 1);
          }
        }
        // Glacial cracks
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(3, 4, 4, 1);
        ctx.fillRect(8, 10, 5, 1);
        ctx.fillRect(9, 11, 2, 1);
      });
      break;
    }

    case BlockType.SANDSTONE: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 72);
            // Stratified layers
            if (y === 3 || y === 4 || y === 11 || y === 12) {
              ctx.fillStyle = '#cbb878';
            } else {
              ctx.fillStyle = v < 0.35 ? '#d9cb8f' : v < 0.7 ? '#ded29a' : '#e6dcab';
            }
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      topTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 73);
            ctx.fillStyle = v < 0.4 ? '#d9cb8f' : '#ded29a';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.CACTUS: {
      sideTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            // Vertical ribbed ridges
            const isRidge = x % 4 === 0 || x % 4 === 1;
            const v = noise(x, y, 74);
            if (isRidge) {
              ctx.fillStyle = v < 0.5 ? '#3f7c22' : '#498827';
            } else {
              ctx.fillStyle = v < 0.5 ? '#569931' : '#61a837';
            }
            ctx.fillRect(x, y, 1, 1);
          }
        }
        // Black thorns
        ctx.fillStyle = '#1c330f';
        ctx.fillRect(2, 3, 1, 2);
        ctx.fillRect(6, 7, 1, 2);
        ctx.fillRect(10, 4, 1, 2);
        ctx.fillRect(14, 9, 1, 2);
        ctx.fillRect(4, 12, 1, 2);
        ctx.fillRect(12, 13, 1, 2);
      });
      topTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            ctx.fillStyle = (x === 0 || x === 15 || y === 0 || y === 15) ? '#3f7c22' : '#569931';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    case BlockType.TORCH: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Flame
        ctx.fillStyle = '#ff7b00';
        ctx.fillRect(6, 2, 4, 4);
        ctx.fillStyle = '#ffee33';
        ctx.fillRect(7, 3, 2, 2);
        // Wood stick
        ctx.fillStyle = '#6b4c2b';
        ctx.fillRect(7, 6, 2, 8);
      });
      break;
    }

    case BlockType.APPLE: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Stem
        ctx.fillStyle = '#4a3219';
        ctx.fillRect(7, 2, 2, 3);
        // Green leaf
        ctx.fillStyle = '#4ea126';
        ctx.fillRect(9, 2, 2, 1);
        // Apple body
        ctx.fillStyle = '#d62020';
        ctx.fillRect(4, 5, 8, 8);
        ctx.fillRect(5, 4, 6, 10);
        // Highlight
        ctx.fillStyle = '#ff7575';
        ctx.fillRect(5, 5, 2, 2);
        // Dark shading
        ctx.fillStyle = '#941010';
        ctx.fillRect(5, 12, 6, 1);
      });
      break;
    }

    case BlockType.BREAD: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Golden brown crust
        ctx.fillStyle = '#9b5b22';
        ctx.fillRect(3, 6, 10, 5);
        ctx.fillRect(4, 5, 8, 7);
        // Soft bread top slits
        ctx.fillStyle = '#c88c4b';
        ctx.fillRect(4, 6, 8, 4);
        ctx.fillStyle = '#e8bb82';
        ctx.fillRect(5, 6, 2, 3);
        ctx.fillRect(9, 6, 2, 3);
      });
      break;
    }

    case BlockType.RAW_BEEF: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Raw red meat
        ctx.fillStyle = '#b83232';
        ctx.fillRect(3, 4, 10, 8);
        ctx.fillStyle = '#8f1e1e';
        ctx.fillRect(4, 5, 8, 6);
        // White fat marbling
        ctx.fillStyle = '#eddada';
        ctx.fillRect(4, 4, 3, 2);
        ctx.fillRect(8, 7, 3, 1);
      });
      break;
    }

    case BlockType.COOKED_BEEF: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Seared dark steak
        ctx.fillStyle = '#592c1c';
        ctx.fillRect(3, 4, 10, 8);
        ctx.fillStyle = '#7a3d24';
        ctx.fillRect(4, 5, 8, 6);
        // Grill marks
        ctx.fillStyle = '#2b1209';
        ctx.fillRect(4, 6, 8, 1);
        ctx.fillRect(4, 9, 8, 1);
      });
      break;
    }

    case BlockType.GOLDEN_APPLE: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Stem
        ctx.fillStyle = '#6b4c1b';
        ctx.fillRect(7, 2, 2, 3);
        // Golden body
        ctx.fillStyle = '#f5c518';
        ctx.fillRect(4, 5, 8, 8);
        ctx.fillRect(5, 4, 6, 10);
        // Gleam
        ctx.fillStyle = '#fff4a3';
        ctx.fillRect(5, 5, 2, 2);
        ctx.fillStyle = '#d49b0b';
        ctx.fillRect(5, 12, 6, 1);
      });
      break;
    }

    case BlockType.WHEAT: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#d4b74a';
        ctx.fillRect(5, 2, 6, 6);
        ctx.fillStyle = '#a68c2d';
        ctx.fillRect(7, 8, 2, 6);
        ctx.fillStyle = '#ebd67a';
        ctx.fillRect(6, 3, 2, 2);
      });
      break;
    }

    case BlockType.STICK: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#6b4c2b';
        // Diagonal stick
        for (let i = 0; i < 10; i++) {
          ctx.fillRect(3 + i, 13 - i, 2, 2);
        }
      });
      break;
    }

    // Pickaxes
    case BlockType.WOODEN_PICKAXE:
    case BlockType.STONE_PICKAXE:
    case BlockType.IRON_PICKAXE:
    case BlockType.DIAMOND_PICKAXE: {
      const headColor =
        blockType === BlockType.WOODEN_PICKAXE
          ? '#9b7145'
          : blockType === BlockType.STONE_PICKAXE
          ? '#808080'
          : blockType === BlockType.IRON_PICKAXE
          ? '#d8d8d8'
          : '#4dedf4';
      const darkColor =
        blockType === BlockType.WOODEN_PICKAXE
          ? '#6b4823'
          : blockType === BlockType.STONE_PICKAXE
          ? '#555555'
          : blockType === BlockType.IRON_PICKAXE
          ? '#9c9c9c'
          : '#1a9ca3';

      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Handle (diagonal brown wood stick)
        ctx.fillStyle = '#5c3d1f';
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(3 + i, 13 - i, 2, 2);
        }
        // Curved Pickaxe Head
        ctx.fillStyle = headColor;
        ctx.fillRect(8, 2, 4, 3);
        ctx.fillRect(12, 4, 2, 3);
        ctx.fillRect(13, 7, 2, 3);
        ctx.fillRect(5, 5, 3, 2);
        ctx.fillRect(4, 7, 2, 3);
        // Head shadow/dark accents
        ctx.fillStyle = darkColor;
        ctx.fillRect(9, 4, 2, 1);
        ctx.fillRect(13, 9, 2, 1);
        ctx.fillRect(4, 9, 2, 1);
      });
      break;
    }

    // Swords
    case BlockType.WOODEN_SWORD:
    case BlockType.IRON_SWORD: {
      const bladeColor = blockType === BlockType.WOODEN_SWORD ? '#a07849' : '#e6e6e6';
      const edgeColor = blockType === BlockType.WOODEN_SWORD ? '#6b4823' : '#a8a8a8';

      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Pommel & handle
        ctx.fillStyle = '#4a2f15';
        ctx.fillRect(2, 13, 2, 2);
        ctx.fillRect(3, 12, 2, 2);
        // Crossguard
        ctx.fillStyle = '#7a552b';
        ctx.fillRect(3, 10, 4, 2);
        ctx.fillRect(4, 11, 2, 2);
        // Blade
        ctx.fillStyle = bladeColor;
        for (let i = 0; i < 7; i++) {
          ctx.fillRect(6 + i, 9 - i, 2, 2);
          ctx.fillRect(7 + i, 8 - i, 2, 2);
        }
        ctx.fillRect(13, 2, 2, 2); // tip
        // Edge
        ctx.fillStyle = edgeColor;
        for (let i = 0; i < 7; i++) {
          ctx.fillRect(6 + i, 8 - i, 1, 1);
        }
      });
      break;
    }

    // Axes
    case BlockType.WOODEN_AXE:
    case BlockType.IRON_AXE: {
      const headColor = blockType === BlockType.WOODEN_AXE ? '#9b7145' : '#d8d8d8';
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Handle
        ctx.fillStyle = '#5c3d1f';
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(3 + i, 13 - i, 2, 2);
        }
        // Heavy Axe Blade
        ctx.fillStyle = headColor;
        ctx.fillRect(7, 2, 5, 4);
        ctx.fillRect(6, 4, 3, 4);
        ctx.fillRect(11, 4, 2, 5);
      });
      break;
    }

    // Deepslate (Derin Kaynak Taşı)
    case BlockType.DEEPSLATE: {
      topTex = createPixelCanvas((ctx) => {
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 71);
            ctx.fillStyle = v < 0.3 ? '#23232a' : v < 0.7 ? '#30303b' : '#3d3d49';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      bottomTex = topTex;
      sideTex = createPixelCanvas((ctx) => {
        for (let y = 0; y < 16; y++) {
          const isStripe = (y % 4 === 0) || (y % 4 === 1);
          for (let x = 0; x < 16; x++) {
            const v = noise(x, y, 72);
            if (isStripe) {
              ctx.fillStyle = v < 0.4 ? '#1c1c22' : '#282833';
            } else {
              ctx.fillStyle = v < 0.4 ? '#33333f' : '#3d3d49';
            }
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });
      break;
    }

    // Deepslate Ores
    case BlockType.DEEPSLATE_COAL_ORE:
    case BlockType.DEEPSLATE_IRON_ORE:
    case BlockType.DEEPSLATE_GOLD_ORE:
    case BlockType.DEEPSLATE_DIAMOND_ORE:
    case BlockType.DEEPSLATE_COPPER_ORE: {
      const gemColors =
        blockType === BlockType.DEEPSLATE_DIAMOND_ORE
          ? ['#2fd5e3', '#7cf1f9', '#1596a2']
          : blockType === BlockType.DEEPSLATE_GOLD_ORE
          ? ['#e8b923', '#fdf374', '#9e7b0e']
          : blockType === BlockType.DEEPSLATE_IRON_ORE
          ? ['#d8af93', '#ecd5c5', '#98684d']
          : blockType === BlockType.DEEPSLATE_COPPER_ORE
          ? ['#d06e42', '#52a38b', '#e88f63']
          : ['#1e1e24', '#383842', '#0c0c10'];

      sideTex = createPixelCanvas((ctx) => {
        // Deepslate background
        for (let y = 0; y < 16; y++) {
          const isStripe = (y % 4 === 0) || (y % 4 === 1);
          for (let x = 0; x < 16; x++) {
            const v = noise(x, y, 73);
            ctx.fillStyle = isStripe
              ? (v < 0.4 ? '#1c1c22' : '#282833')
              : (v < 0.4 ? '#33333f' : '#3d3d49');
            ctx.fillRect(x, y, 1, 1);
          }
        }
        // Glowing Gem Clusters
        const clusters = [[3, 4], [8, 3], [5, 9], [11, 8], [9, 12], [2, 11]];
        clusters.forEach(([cx, cy], i) => {
          ctx.fillStyle = gemColors[0];
          ctx.fillRect(cx, cy, 2, 2);
          ctx.fillStyle = gemColors[1];
          ctx.fillRect(cx, cy, 1, 1);
          ctx.fillStyle = gemColors[2] || gemColors[0];
          ctx.fillRect(cx + 1, cy + 1, 1, 1);
        });
      });
      break;
    }

    // Copper Ore (Bakır Cevheri)
    case BlockType.COPPER_ORE: {
      sideTex = createPixelCanvas((ctx) => {
        // Natural Stone background
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 74);
            ctx.fillStyle = v < 0.3 ? '#636363' : v < 0.7 ? '#757575' : '#888888';
            ctx.fillRect(x, y, 1, 1);
          }
        }
        // Orange & turquoise copper specks
        const copperSpecks = [[3, 3], [4, 4], [8, 5], [9, 4], [4, 10], [5, 11], [11, 9], [12, 10]];
        copperSpecks.forEach(([sx, sy], i) => {
          ctx.fillStyle = i % 2 === 0 ? '#d06e42' : '#52a38b';
          ctx.fillRect(sx, sy, 2, 2);
          ctx.fillStyle = '#f09160';
          ctx.fillRect(sx, sy, 1, 1);
        });
      });
      break;
    }

    // Copper Ingot (Bakır Külçesi)
    case BlockType.COPPER_INGOT: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#b35429';
        ctx.fillRect(4, 5, 8, 6);
        ctx.fillStyle = '#d87747';
        ctx.fillRect(5, 6, 6, 4);
        ctx.fillStyle = '#f39e73';
        ctx.fillRect(5, 6, 5, 1);
      });
      break;
    }

    // Copper Block
    case BlockType.COPPER_BLOCK: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#bf6337';
        ctx.fillRect(0, 0, 16, 16);
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            const v = noise(x, y, 75);
            if (v < 0.25) {
              ctx.fillStyle = '#a9542a';
              ctx.fillRect(x, y, 1, 1);
            } else if (v > 0.75) {
              ctx.fillStyle = '#d67545';
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        ctx.strokeStyle = '#8d411d';
        ctx.strokeRect(0.5, 0.5, 15, 15);
      });
      break;
    }

    // Copper Pickaxe & Sword
    case BlockType.COPPER_PICKAXE: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#5c3d1f';
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(3 + i, 13 - i, 2, 2);
        }
        ctx.fillStyle = '#c86438';
        ctx.fillRect(6, 3, 3, 2);
        ctx.fillRect(8, 2, 4, 3);
        ctx.fillRect(11, 2, 3, 2);
        ctx.fillRect(13, 3, 2, 3);
        ctx.fillRect(4, 5, 2, 4);
      });
      break;
    }

    case BlockType.COPPER_SWORD: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#5c3d1f';
        ctx.fillRect(2, 13, 3, 3);
        ctx.fillStyle = '#7a552b';
        ctx.fillRect(3, 10, 4, 2);
        ctx.fillStyle = '#c86438';
        for (let i = 0; i < 7; i++) {
          ctx.fillRect(6 + i, 9 - i, 2, 2);
          ctx.fillRect(7 + i, 8 - i, 2, 2);
        }
        ctx.fillRect(13, 2, 2, 2);
      });
      break;
    }

    // Diamond Sword (Elmas Kılıç)
    case BlockType.DIAMOND_SWORD: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Hilt
        ctx.fillStyle = '#5c3d1f';
        ctx.fillRect(2, 13, 3, 3);
        // Crossguard
        ctx.fillStyle = '#2c5b6b';
        ctx.fillRect(3, 10, 4, 2);
        ctx.fillRect(4, 11, 2, 2);
        // Diamond Blade
        ctx.fillStyle = '#4dedf4';
        for (let i = 0; i < 7; i++) {
          ctx.fillRect(6 + i, 9 - i, 2, 2);
          ctx.fillRect(7 + i, 8 - i, 2, 2);
        }
        ctx.fillRect(13, 2, 2, 2);
        // Bright shining diamond edge
        ctx.fillStyle = '#a6f8fb';
        for (let i = 0; i < 7; i++) {
          ctx.fillRect(6 + i, 8 - i, 1, 1);
        }
      });
      break;
    }

    // Armors (Zırhlar)
    case BlockType.DIAMOND_CHESTPLATE:
    case BlockType.IRON_CHESTPLATE: {
      const mainCol = blockType === BlockType.DIAMOND_CHESTPLATE ? '#4dedf4' : '#dcdcdc';
      const shadowCol = blockType === BlockType.DIAMOND_CHESTPLATE ? '#1f9fad' : '#9d9d9d';
      const shineCol = blockType === BlockType.DIAMOND_CHESTPLATE ? '#b4f9fc' : '#ffffff';

      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Shoulders
        ctx.fillStyle = mainCol;
        ctx.fillRect(2, 3, 4, 3);
        ctx.fillRect(10, 3, 4, 3);
        // Neck cutout
        ctx.fillRect(3, 6, 10, 7);
        // Sleeves
        ctx.fillRect(1, 4, 2, 5);
        ctx.fillRect(13, 4, 2, 5);
        // Shadows & details
        ctx.fillStyle = shadowCol;
        ctx.fillRect(5, 6, 6, 2);
        ctx.fillRect(4, 12, 8, 1);
        // Shines
        ctx.fillStyle = shineCol;
        ctx.fillRect(3, 3, 2, 1);
        ctx.fillRect(11, 3, 2, 1);
      });
      break;
    }

    // Stone Bricks & Stronghold variants
    case BlockType.STONE_BRICKS:
    case BlockType.MOSSY_STONE_BRICKS:
    case BlockType.CRACKED_STONE_BRICKS: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#7a7a7a';
        ctx.fillRect(0, 0, 16, 16);
        // Mortar lines
        ctx.fillStyle = '#404040';
        ctx.fillRect(0, 3, 16, 1);
        ctx.fillRect(0, 7, 16, 1);
        ctx.fillRect(0, 11, 16, 1);
        ctx.fillRect(0, 15, 16, 1);
        // Vertical mortar joints
        ctx.fillRect(4, 0, 1, 3);
        ctx.fillRect(12, 0, 1, 3);
        ctx.fillRect(8, 4, 1, 3);
        ctx.fillRect(4, 8, 1, 3);
        ctx.fillRect(12, 8, 1, 3);
        ctx.fillRect(8, 12, 1, 3);

        // Brick noise
        for (let x = 0; x < 16; x++) {
          for (let y = 0; y < 16; y++) {
            if (noise(x, y, 76) < 0.25) {
              ctx.fillStyle = '#656565';
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }

        if (blockType === BlockType.MOSSY_STONE_BRICKS) {
          ctx.fillStyle = '#4d7a36';
          const mossSpots = [[2, 2], [3, 3], [7, 6], [8, 7], [10, 10], [11, 11], [3, 13]];
          mossSpots.forEach(([mx, my]) => {
            ctx.fillRect(mx, my, 2, 2);
          });
        } else if (blockType === BlockType.CRACKED_STONE_BRICKS) {
          ctx.fillStyle = '#262626';
          ctx.fillRect(3, 1, 1, 4);
          ctx.fillRect(4, 4, 2, 1);
          ctx.fillRect(9, 6, 3, 1);
          ctx.fillRect(11, 7, 1, 3);
        }
      });
      break;
    }

    // Iron Bars (Demir Parmaklık)
    case BlockType.IRON_BARS: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#8a8a9a';
        // Vertical bars
        ctx.fillRect(3, 0, 2, 16);
        ctx.fillRect(7, 0, 2, 16);
        ctx.fillRect(11, 0, 2, 16);
        // Horizontal rails
        ctx.fillRect(0, 2, 16, 2);
        ctx.fillRect(0, 12, 16, 2);
        // Highlights
        ctx.fillStyle = '#b0b0c2';
        ctx.fillRect(3, 0, 1, 16);
        ctx.fillRect(7, 0, 1, 16);
        ctx.fillRect(11, 0, 1, 16);
      });
      break;
    }

    // End Portal Frame (Portal Çerçevesi)
    case BlockType.END_PORTAL_FRAME: {
      topTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#2d5042'; // green end stone rim
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#1c362c';
        ctx.fillRect(1, 1, 14, 14);
        // Gold/obsidian eye socket in center
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(4, 4, 8, 8);
        ctx.fillStyle = '#1b1b22';
        ctx.fillRect(5, 5, 6, 6);
        // Glowing cyan diamond in socket
        ctx.fillStyle = '#4dedf4';
        ctx.fillRect(6, 6, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(7, 7, 2, 2);
      });
      bottomTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#d9d2a6'; // end stone base
        ctx.fillRect(0, 0, 16, 16);
      });
      sideTex = createPixelCanvas((ctx) => {
        // Lower half end stone
        ctx.fillStyle = '#d9d2a6';
        ctx.fillRect(0, 6, 16, 10);
        // Upper rim dark mossy stone
        ctx.fillStyle = '#2d5042';
        ctx.fillRect(0, 0, 16, 6);
        // Eye emblem
        ctx.fillStyle = '#d4af37';
        ctx.fillRect(6, 2, 4, 3);
      });
      break;
    }

    // End Portal (Aktif Kozmik Portal)
    case BlockType.END_PORTAL: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#06010d'; // void black
        ctx.fillRect(0, 0, 16, 16);
        // Cosmic stars
        const stars = [[2, 3], [7, 2], [12, 4], [4, 8], [9, 10], [13, 11], [3, 13], [10, 14]];
        stars.forEach(([sx, sy], i) => {
          ctx.fillStyle = i % 2 === 0 ? '#4dedf4' : '#ba55d3';
          ctx.fillRect(sx, sy, 1, 1);
        });
      });
      break;
    }

    // Pure Diamond Gemstone (Saf Elmas)
    case BlockType.DIAMOND: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Diamond gem diamond silhouette
        ctx.fillStyle = '#1f8c9b'; // dark teal outline
        ctx.fillRect(5, 3, 6, 2);
        ctx.fillRect(3, 5, 10, 3);
        ctx.fillRect(4, 8, 8, 3);
        ctx.fillRect(6, 11, 4, 2);
        ctx.fillRect(7, 13, 2, 1);

        // Bright cyan fill
        ctx.fillStyle = '#4dedf4';
        ctx.fillRect(6, 4, 4, 1);
        ctx.fillRect(4, 6, 8, 2);
        ctx.fillRect(5, 8, 6, 2);
        ctx.fillRect(7, 10, 2, 2);

        // Pure white facet highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(6, 5, 2, 2);
        ctx.fillRect(5, 7, 2, 1);
        ctx.fillRect(8, 8, 1, 1);

        // Deep blue shade facet
        ctx.fillStyle = '#2db8cc';
        ctx.fillRect(9, 6, 2, 2);
        ctx.fillRect(7, 11, 1, 2);
      });
      break;
    }

    // Coal Mineral (Kömür Parçası)
    case BlockType.COAL: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#141414'; // dark outline
        ctx.fillRect(5, 4, 7, 2);
        ctx.fillRect(4, 6, 9, 5);
        ctx.fillRect(6, 11, 6, 2);

        ctx.fillStyle = '#2c2c2c'; // dark charcoal
        ctx.fillRect(5, 5, 6, 6);

        ctx.fillStyle = '#4f4f4f'; // highlight sheen
        ctx.fillRect(6, 5, 2, 2);
        ctx.fillRect(5, 7, 2, 1);
        ctx.fillRect(8, 8, 2, 1);
      });
      break;
    }

    // Raw Iron Mineral (Ham Demir)
    case BlockType.RAW_IRON: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#594435'; // outline
        ctx.fillRect(5, 4, 6, 2);
        ctx.fillRect(4, 6, 8, 6);
        ctx.fillRect(6, 12, 4, 2);

        ctx.fillStyle = '#d8af93'; // raw iron peach-tan
        ctx.fillRect(5, 5, 6, 6);

        ctx.fillStyle = '#fae1cf'; // metallic highlight
        ctx.fillRect(6, 5, 3, 2);
        ctx.fillRect(5, 7, 2, 2);

        ctx.fillStyle = '#9e795d'; // stone impurities
        ctx.fillRect(8, 8, 2, 2);
      });
      break;
    }

    // Raw Gold Mineral (Ham Altın)
    case BlockType.RAW_GOLD: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#7a6012'; // dark gold outline
        ctx.fillRect(5, 4, 6, 2);
        ctx.fillRect(4, 6, 8, 5);
        ctx.fillRect(5, 11, 5, 2);

        ctx.fillStyle = '#ffd700'; // pure gold
        ctx.fillRect(5, 5, 6, 5);

        ctx.fillStyle = '#fffaaa'; // gleaming shine
        ctx.fillRect(6, 5, 2, 2);
        ctx.fillRect(5, 7, 2, 1);

        ctx.fillStyle = '#c79c10'; // shade
        ctx.fillRect(7, 8, 3, 2);
      });
      break;
    }

    // Raw Copper Mineral (Ham Bakır)
    case BlockType.RAW_COPPER: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = '#4a2515'; // outline
        ctx.fillRect(5, 4, 6, 2);
        ctx.fillRect(4, 6, 8, 6);
        ctx.fillRect(5, 12, 5, 1);

        ctx.fillStyle = '#c86438'; // copper orange
        ctx.fillRect(5, 5, 6, 6);

        ctx.fillStyle = '#e88f63'; // copper shine
        ctx.fillRect(6, 5, 2, 2);
        ctx.fillRect(5, 7, 2, 1);

        ctx.fillStyle = '#427863'; // oxidized green fleck
        ctx.fillRect(8, 8, 2, 2);
      });
      break;
    }

    // Diamond Helmet
    case BlockType.DIAMOND_HELMET:
    case BlockType.IRON_HELMET: {
      const isDia = blockType === BlockType.DIAMOND_HELMET;
      const baseCol = isDia ? '#4dedf4' : '#d8d8d8';
      const darkCol = isDia ? '#1f8c9b' : '#888888';
      const shineCol = isDia ? '#ffffff' : '#ffffff';
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = darkCol;
        ctx.fillRect(4, 3, 8, 8);
        ctx.fillStyle = baseCol;
        ctx.fillRect(5, 4, 6, 4);
        ctx.fillRect(4, 8, 2, 4);
        ctx.fillRect(10, 8, 2, 4);
        ctx.fillRect(7, 8, 2, 3);
        ctx.fillStyle = shineCol;
        ctx.fillRect(5, 4, 2, 2);
      });
      break;
    }

    // Diamond & Iron Leggings
    case BlockType.DIAMOND_LEGGINGS:
    case BlockType.IRON_LEGGINGS: {
      const isDia = blockType === BlockType.DIAMOND_LEGGINGS;
      const baseCol = isDia ? '#4dedf4' : '#d8d8d8';
      const darkCol = isDia ? '#1f8c9b' : '#888888';
      const shineCol = isDia ? '#ffffff' : '#ffffff';
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = darkCol;
        ctx.fillRect(3, 2, 10, 12);
        ctx.clearRect(7, 7, 2, 7);
        ctx.fillStyle = baseCol;
        ctx.fillRect(4, 3, 8, 3);
        ctx.fillRect(4, 6, 3, 7);
        ctx.fillRect(9, 6, 3, 7);
        ctx.fillStyle = shineCol;
        ctx.fillRect(4, 4, 2, 1);
        ctx.fillRect(4, 7, 1, 4);
      });
      break;
    }

    // Diamond & Iron Boots
    case BlockType.DIAMOND_BOOTS:
    case BlockType.IRON_BOOTS: {
      const isDia = blockType === BlockType.DIAMOND_BOOTS;
      const baseCol = isDia ? '#4dedf4' : '#d8d8d8';
      const darkCol = isDia ? '#1f8c9b' : '#888888';
      const shineCol = isDia ? '#ffffff' : '#ffffff';
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        ctx.fillStyle = darkCol;
        ctx.fillRect(2, 6, 5, 8);
        ctx.fillRect(9, 6, 5, 8);
        ctx.fillStyle = baseCol;
        ctx.fillRect(3, 7, 3, 4);
        ctx.fillRect(3, 11, 4, 2);
        ctx.fillRect(10, 7, 3, 4);
        ctx.fillRect(10, 11, 4, 2);
        ctx.fillStyle = shineCol;
        ctx.fillRect(3, 7, 1, 2);
        ctx.fillRect(10, 7, 1, 2);
      });
      break;
    }

    // Shield (Kalkan)
    case BlockType.SHIELD: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.clearRect(0, 0, 16, 16);
        // Outer iron rim
        ctx.fillStyle = '#cfcfcf';
        ctx.fillRect(3, 1, 10, 14);
        // Curved bottom
        ctx.clearRect(3, 13, 2, 2);
        ctx.clearRect(11, 13, 2, 2);
        ctx.clearRect(3, 14, 3, 1);
        ctx.clearRect(10, 14, 3, 1);
        // Wood planks face
        ctx.fillStyle = '#8f6534';
        ctx.fillRect(4, 2, 8, 11);
        ctx.fillStyle = '#6b4c2b';
        ctx.fillRect(7, 2, 2, 11);
        // Center iron boss / emblem
        ctx.fillStyle = '#d8d8d8';
        ctx.fillRect(6, 6, 4, 4);
        ctx.fillStyle = '#444444';
        ctx.fillRect(7, 7, 2, 2);
      });
      break;
    }

    default: {
      sideTex = createPixelCanvas((ctx) => {
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, 0, 16, 16);
      });
    }
  }

  textureCache.set(cacheKey, sideTex);
  if (topTex) textureCache.set(`${cacheKey}_top`, topTex);
  if (bottomTex) textureCache.set(`${cacheKey}_bottom`, bottomTex);

  return { side: sideTex, top: topTex, bottom: bottomTex };
}

// Materials cache for Three.js mesh faces: [+X, -X, +Y (top), -Y (bottom), +Z, -Z]
const materialCache = new Map<BlockType, THREE.Material[]>();

export function getBlockMaterials(blockType: BlockType): THREE.Material[] {
  if (materialCache.has(blockType)) {
    return materialCache.get(blockType)!;
  }

  const { side, top, bottom } = getBlockTextures(blockType);
  const effectiveTop = top || side;
  const effectiveBottom = bottom || side;

  const isTransparent =
    blockType === BlockType.GLASS ||
    blockType === BlockType.WATER ||
    blockType === BlockType.ICE ||
    blockType === BlockType.LEAVES ||
    blockType === BlockType.TORCH ||
    blockType === BlockType.IRON_BARS ||
    blockType === BlockType.END_PORTAL;

  const opacity =
    blockType === BlockType.WATER
      ? 0.7
      : blockType === BlockType.GLASS
      ? 0.5
      : blockType === BlockType.ICE
      ? 0.82
      : blockType === BlockType.LEAVES
      ? 0.95
      : blockType === BlockType.END_PORTAL
      ? 0.9
      : 1.0;

  const createMat = (tex: THREE.CanvasTexture) => {
    return new THREE.MeshLambertMaterial({
      map: tex,
      transparent: isTransparent,
      opacity: opacity,
      depthWrite: blockType !== BlockType.WATER && blockType !== BlockType.END_PORTAL,
      alphaTest: (blockType === BlockType.TORCH || blockType === BlockType.IRON_BARS) ? 0.5 : 0,
    });
  };

  const materials: THREE.Material[] = [
    createMat(side), // +X right
    createMat(side), // -X left
    createMat(effectiveTop), // +Y top
    createMat(effectiveBottom), // -Y bottom
    createMat(side), // +Z front
    createMat(side), // -Z back
  ];

  materialCache.set(blockType, materials);
  return materials;
}

// 10 Progressive Block Cracking Stage Textures (0 to 9)
const breakStageTextures: THREE.CanvasTexture[] = [];
const breakStageMaterials: THREE.MeshBasicMaterial[] = [];

export function getBreakStageMaterial(stage: number): THREE.MeshBasicMaterial {
  const clampedStage = Math.max(0, Math.min(9, Math.floor(stage)));
  if (breakStageMaterials[clampedStage]) {
    return breakStageMaterials[clampedStage];
  }

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 16, 16);

  // Progressive crack branches (black with semi-transparent jagged lines)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  const crackDensity = clampedStage + 1;

  // Base crack segments
  const crackSegments: [number, number, number, number][] = [
    [7, 7, 9, 8],
    [8, 7, 7, 10],
    [9, 8, 11, 7],
    [7, 10, 5, 12],
    [8, 7, 8, 4],
    [8, 4, 11, 3],
    [5, 12, 3, 14],
    [11, 7, 13, 9],
    [11, 3, 14, 2],
    [8, 7, 5, 6],
    [5, 6, 2, 7],
    [7, 10, 9, 12],
    [9, 12, 12, 14],
    [5, 6, 4, 3],
    [4, 3, 2, 2],
  ];

  const linesToDraw = Math.min(crackSegments.length, Math.ceil((crackDensity / 10) * crackSegments.length));
  for (let i = 0; i < linesToDraw; i++) {
    const [x1, y1, x2, y2] = crackSegments[i];
    // Bresenham-like line plotting on 16x16 canvas
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let cx = x1;
    let cy = y1;

    while (true) {
      ctx.fillRect(cx, cy, 1, 1);
      if (clampedStage >= 5 && Math.random() < 0.3) {
        ctx.fillRect(cx + (Math.random() > 0.5 ? 1 : -1), cy, 1, 1);
      }
      if (cx === x2 && cy === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  breakStageTextures[clampedStage] = texture;

  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1, // Render strictly in front of block faces
    polygonOffsetUnits: -1,
  });

  breakStageMaterials[clampedStage] = mat;
  return mat;
}

