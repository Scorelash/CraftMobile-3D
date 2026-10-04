import { BlockType, BLOCK_DEFS } from './constants';
import { getBlockTextures } from './textures';

// Cache generated Data URLs for rapid zero-cost rendering
const iconCache = new Map<BlockType, string>();

/**
 * Procedurally renders authentic Minecraft 3D isometric block icons and 2D pixel-art item sprites
 * onto a 36x36 pixel canvas and returns a PNG Data URL.
 */
export function getItemIconUrl(blockType: BlockType): string {
  if (blockType === BlockType.AIR) {
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }

  if (iconCache.has(blockType)) {
    return iconCache.get(blockType)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 36;
  canvas.height = 36;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const def = BLOCK_DEFS[blockType];
  const isTool = def?.isTool;
  const isFlatItem =
    isTool ||
    blockType === BlockType.APPLE ||
    blockType === BlockType.BREAD ||
    blockType === BlockType.RAW_BEEF ||
    blockType === BlockType.COOKED_BEEF ||
    blockType === BlockType.GOLDEN_APPLE ||
    blockType === BlockType.WHEAT ||
    blockType === BlockType.STICK ||
    blockType === BlockType.TORCH ||
    blockType === BlockType.COPPER_INGOT ||
    blockType === BlockType.IRON_BARS;

  if (isFlatItem) {
    // Render 2D pixel-art sprite scaled to 36x36
    const { side } = getBlockTextures(blockType);
    const sourceCanvas = side.image as HTMLCanvasElement;
    if (sourceCanvas) {
      // Draw centered with nearest-neighbor scaling
      ctx.drawImage(sourceCanvas, 2, 2, 32, 32);
    } else {
      // Fallback
      ctx.fillStyle = def?.iconColor || '#888';
      ctx.fillRect(4, 4, 28, 28);
    }
  } else {
    // Render 3D Isometric Minecraft Block (Top, Left, Right faces)
    renderIsometricBlock(ctx, blockType);
  }

  const dataUrl = canvas.toDataURL();
  iconCache.set(blockType, dataUrl);
  return dataUrl;
}

/**
 * Draws a 3D isometric Minecraft cube on a 36x36 canvas:
 * Top face (bright), Left face (medium shade), Right face (dark shade)
 */
function renderIsometricBlock(ctx: CanvasRenderingContext2D, blockType: BlockType) {
  const { top, side, bottom } = getBlockTextures(blockType);
  const topCanvas = (top ? top.image : side.image) as HTMLCanvasElement;
  const sideCanvas = side.image as HTMLCanvasElement;

  // Isometric vertices on 36x36 canvas
  const centerX = 18;
  const centerY = 18;
  const radiusX = 14;
  const radiusY = 8;
  const height = 14;

  const topCenter = { x: centerX, y: centerY - height };
  const topTop = { x: centerX, y: topCenter.y - radiusY };
  const topRight = { x: centerX + radiusX, y: topCenter.y };
  const topBottom = { x: centerX, y: topCenter.y + radiusY };
  const topLeft = { x: centerX - radiusX, y: topCenter.y };

  const bottomBottom = { x: centerX, y: topBottom.y + height };
  const bottomLeft = { x: topLeft.x, y: topLeft.y + height };
  const bottomRight = { x: topRight.x, y: topRight.y + height };

  // 1. TOP FACE (Bright / direct sun)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topTop.x, topTop.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(topBottom.x, topBottom.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.closePath();
  ctx.clip();

  if (topCanvas) {
    ctx.drawImage(topCanvas, 0, 0, 36, 36);
  } else {
    ctx.fillStyle = BLOCK_DEFS[blockType]?.iconColor || '#5b8e34';
    ctx.fill();
  }
  // Light tint for top face
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
  ctx.restore();

  // 2. LEFT FACE (Medium shade - 80% brightness)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topBottom.x, topBottom.y);
  ctx.lineTo(bottomBottom.x, bottomBottom.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.closePath();
  ctx.clip();

  if (sideCanvas) {
    ctx.drawImage(sideCanvas, 0, 8, 36, 36);
  } else {
    ctx.fillStyle = BLOCK_DEFS[blockType]?.iconColor || '#866043';
    ctx.fill();
  }
  // Left face shade
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fill();
  ctx.restore();

  // 3. RIGHT FACE (Dark shade - 60% brightness)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topBottom.x, topBottom.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomBottom.x, bottomBottom.y);
  ctx.closePath();
  ctx.clip();

  if (sideCanvas) {
    ctx.drawImage(sideCanvas, 0, 8, 36, 36);
  } else {
    ctx.fillStyle = BLOCK_DEFS[blockType]?.iconColor || '#866043';
    ctx.fill();
  }
  // Right face dark shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fill();
  ctx.restore();

  // 4. Subtle crisp edges / pixel outline
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';

  // Outer silhouette
  ctx.beginPath();
  ctx.moveTo(topTop.x, topTop.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomBottom.x, bottomBottom.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.closePath();
  ctx.stroke();

  // Internal edges
  ctx.beginPath();
  ctx.moveTo(topBottom.x, topBottom.y);
  ctx.lineTo(topCenter.x, topBottom.y + height);
  ctx.moveTo(topBottom.x, topBottom.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.moveTo(topBottom.x, topBottom.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.stroke();
}
