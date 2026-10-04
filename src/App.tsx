import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VoxelGameEngine } from './game/engine';
import { generateWorld, buildStructure, STRONGHOLD_POS } from './game/worldGen';
import {
  BlockType,
  BLOCK_DEFS,
  DEFAULT_SURVIVAL_HOTBAR,
  DEFAULT_CREATIVE_HOTBAR,
  InventorySlot,
  INVENTORY_SIZE,
} from './game/constants';
import { getItemIconUrl } from './game/itemIcons';
import { TouchControls } from './components/TouchControls';
import { Hotbar } from './components/Hotbar';
import { InventoryModal, EquippedArmorState } from './components/InventoryModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { SettingsModal } from './components/SettingsModal';
import { GameHUD } from './components/GameHUD';
import { SavedWorldData } from './services/drive';
import { sound } from './game/audio';

// Initial 36 inventory slots (9 hotbar + 27 backpack)
const createInitialInventory = (): InventorySlot[] => {
  const inv: InventorySlot[] = [...DEFAULT_SURVIVAL_HOTBAR];

  // 27 Backpack starter slots
  const backpackStarters: InventorySlot[] = [
    { type: BlockType.OAK_WOOD, count: 16 },
    { type: BlockType.COBBLESTONE, count: 32 },
    { type: BlockType.WHEAT, count: 9 },
    { type: BlockType.BREAD, count: 4 },
    { type: BlockType.APPLE, count: 5 },
    { type: BlockType.COAL_ORE, count: 12 },
    { type: BlockType.TORCH, count: 16 },
    { type: BlockType.IRON_ORE, count: 8 },
    { type: BlockType.SAND, count: 20 },
  ];

  inv.push(...backpackStarters);

  // Fill remaining slots up to 36 with empty AIR
  while (inv.length < INVENTORY_SIZE) {
    inv.push({ type: BlockType.AIR, count: 0 });
  }

  return inv;
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VoxelGameEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  // 36 Inventory slots (0 to 8: Hotbar, 9 to 35: Backpack)
  const [inventory, setInventory] = useState<InventorySlot[]>(createInitialInventory);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [offhandSlot, setOffhandSlot] = useState<InventorySlot>({
    type: BlockType.TORCH,
    count: 16,
  });
  const [equippedArmor, setEquippedArmor] = useState<EquippedArmorState>({
    helmet: BlockType.AIR,
    chestplate: BlockType.AIR,
    leggings: BlockType.AIR,
    boots: BlockType.AIR,
  });
  const [inventoryModalTab, setInventoryModalTab] = useState<'inventory' | 'craftingTable'>('inventory');
  const [gameMode, setGameMode] = useState<'creative' | 'survival'>('survival');
  const [targetedBlockInfo, setTargetedBlockInfo] = useState<{
    x: number;
    y: number;
    z: number;
    blockType: BlockType;
  } | null>(null);

  // Modals state
  const [isDriveOpen, setIsDriveOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Progressive Mining State
  const [miningProgress, setMiningProgress] = useState(0);
  const [isMining, setIsMining] = useState(false);
  const [miningBlockType, setMiningBlockType] = useState<BlockType | null>(null);
  const [requiredToolMet, setRequiredToolMet] = useState(true);

  // Settings
  const [touchSensitivity, setTouchSensitivity] = useState(1.0);

  // Toast notification
  const [notification, setNotification] = useState<string | null>(
    'CraftMobile 3D Hayatta Kalma Dünyasına Hoş Geldin!'
  );

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  // Initialize Game Engine and World
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new VoxelGameEngine(containerRef.current);
    engineRef.current = engine;
    engine.player.gameMode = 'survival';
    setGameMode('survival');

    // Generate initial procedural terrain
    const initialBlocks = generateWorld();
    engine.loadWorld(initialBlocks);

    // Callbacks for survival pickup, damage, and death
    engine.onItemPickupCallback = (type: BlockType, count: number) => {
      setInventory((prev) => {
        const next = [...prev];
        let remaining = count;

        // 1. Stack into existing slots
        for (let i = 0; i < next.length; i++) {
          if (next[i].type === type && next[i].count < 64) {
            const add = Math.min(64 - next[i].count, remaining);
            next[i] = { ...next[i], count: next[i].count + add };
            remaining -= add;
            if (remaining <= 0) break;
          }
        }

        // 2. Put into first empty slot
        if (remaining > 0) {
          for (let i = 0; i < next.length; i++) {
            if (next[i].type === BlockType.AIR || next[i].count <= 0) {
              next[i] = { type, count: remaining };
              remaining = 0;
              break;
            }
          }
        }

        return next;
      });

      sound.playPickup();
      const def = BLOCK_DEFS[type];
      showNotification(`+${count} ${def?.nameTr || 'Eşya'}`);
    };

    engine.onPlayerHurtCallback = (newHealth: number, reason: string) => {
      showNotification(`⚠️ ${reason}! (Can: ${Math.round(newHealth)}/20)`);
    };

    engine.onPlayerDieCallback = () => {
      showNotification('💀 Öldün!');
    };

    engine.onMiningProgressCallback = (progress, bType, reqMet) => {
      setMiningProgress(progress);
      setIsMining(progress > 0);
      setMiningBlockType(bType);
      setRequiredToolMet(reqMet);
    };

    engine.onToolWarningCallback = (warningMsg) => {
      showNotification(warningMsg);
    };

    // Callback when offhand block placed
    engine.onOffhandBlockUsedCallback = () => {
      if (engine.player.gameMode === 'survival') {
        setOffhandSlot((prev) => {
          if (prev.count > 1) {
            return { ...prev, count: prev.count - 1 };
          }
          return { type: BlockType.AIR, count: 0 };
        });
      }
    };

    // Callback when clicking Crafting Table block in world
    engine.onCraftingTableInteract = () => {
      setInventoryModalTab('craftingTable');
      setIsInventoryOpen(true);
      showNotification('🔨 Çalışma Masası Açıldı! (3x3 Kazma & Silah Üretimi)');
    };

    // Callback when interacting with End Portal Frame in Stronghold
    // User request: "strongold'a eşya çerçevesi olan şeyi Ender gözü değil elmasları koyalım"
    engine.onPortalFrameInteract = (x: number, y: number, z: number) => {
      // Find diamonds in main hand, offhand, or backpack
      let hasDiamond = false;
      let consumeSource: 'main' | 'offhand' | number | null = null;

      const mainSlot = inventory[selectedSlot];
      if (mainSlot?.type === BlockType.DIAMOND || mainSlot?.type === BlockType.DIAMOND_ORE) {
        hasDiamond = true;
        consumeSource = 'main';
      } else if (offhandSlot?.type === BlockType.DIAMOND || offhandSlot?.type === BlockType.DIAMOND_ORE) {
        hasDiamond = true;
        consumeSource = 'offhand';
      } else {
        const invIdx = inventory.findIndex(
          (s) => (s.type === BlockType.DIAMOND || s.type === BlockType.DIAMOND_ORE) && s.count > 0
        );
        if (invIdx !== -1) {
          hasDiamond = true;
          consumeSource = invIdx;
        }
      }

      if (!hasDiamond && engine.player.gameMode === 'survival') {
        showNotification('💎 Portal Çerçevesini Aktifleştirmek İçin Elmas Gerekiyor!');
        return false;
      }

      // Consume diamond in survival
      if (engine.player.gameMode === 'survival' && consumeSource !== null) {
        if (consumeSource === 'main') {
          setInventory((prev) => {
            const next = [...prev];
            const s = next[selectedSlot];
            if (s.count > 1) next[selectedSlot] = { ...s, count: s.count - 1 };
            else next[selectedSlot] = { type: BlockType.AIR, count: 0 };
            return next;
          });
        } else if (consumeSource === 'offhand') {
          setOffhandSlot((prev) => {
            if (prev.count > 1) return { ...prev, count: prev.count - 1 };
            return { type: BlockType.AIR, count: 0 };
          });
        } else if (typeof consumeSource === 'number') {
          setInventory((prev) => {
            const next = [...prev];
            const s = next[consumeSource as number];
            if (s.count > 1) next[consumeSource as number] = { ...s, count: s.count - 1 };
            else next[consumeSource as number] = { type: BlockType.AIR, count: 0 };
            return next;
          });
        }
      }

      sound.playLevelUp();
      showNotification('💎 Portal Çerçevesine Elmas Yerleştirildi!');
      engine.setBlock(x, y, z, BlockType.GLOWSTONE);

      // Check remaining unactivated portal frames around the 3x3 stronghold portal
      let remainingFrames = 0;
      for (let dx = -4; dx <= 4; dx++) {
        for (let dz = -4; dz <= 4; dz++) {
          if (engine.getBlock(STRONGHOLD_POS.x + dx, 5, STRONGHOLD_POS.z + dz) === BlockType.END_PORTAL_FRAME) {
            remainingFrames++;
          }
        }
      }

      if (remainingFrames <= 1) {
        // Activate full 3 x 3 portal pool! (9 cosmic portal blocks)
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            engine.setBlock(STRONGHOLD_POS.x + dx, 5, STRONGHOLD_POS.z + dz, BlockType.END_PORTAL);
          }
        }
        engine.spawnBoss(STRONGHOLD_POS.x, 11, STRONGHOLD_POS.z);
        sound.playLevelUp();
        showNotification('🌌 ENDER PORTALI (3x3) AÇILDI! EJDERHA UYANDI!');
      }

      return true;
    };

    // Callback when player aims crosshair at any block in the world
    engine.onTargetBlockChange = (target) => {
      setTargetedBlockInfo(target);
    };

    setEngineReady(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [showNotification, inventory, selectedSlot, offhandSlot]);

  // Update hand-held 3D block when selected slot or item changes
  useEffect(() => {
    if (engineRef.current) {
      const activeSlot = inventory[selectedSlot];
      const activeType = activeSlot && activeSlot.count > 0 ? activeSlot.type : BlockType.AIR;
      engineRef.current.setHandBlock(activeType);
    }
  }, [selectedSlot, inventory]);

  // Update off-hand 3D item when offhandSlot changes
  useEffect(() => {
    if (engineRef.current) {
      const offType = offhandSlot && offhandSlot.count > 0 ? offhandSlot.type : BlockType.AIR;
      engineRef.current.setOffhandBlock(offType);
    }
  }, [offhandSlot]);

  // Update armor defense points in engine when equipped armor changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setEquippedArmor([
        equippedArmor.helmet,
        equippedArmor.chestplate,
        equippedArmor.leggings,
        equippedArmor.boots,
      ]);
    }
  }, [equippedArmor]);

  // Primary Action: Place Block OR Eat Food
  const handlePlaceOrEat = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const currentSlot = inventory[selectedSlot];
    if (!currentSlot || currentSlot.count <= 0 || currentSlot.type === BlockType.AIR) {
      return;
    }

    const def = BLOCK_DEFS[currentSlot.type];

    // Case 1: Food Item -> EAT!
    if (def?.isFood) {
      const eaten = engine.eatFood(currentSlot.type);
      if (eaten) {
        if (engine.player.gameMode === 'survival') {
          setInventory((prev) => {
            const next = [...prev];
            const slot = next[selectedSlot];
            if (slot.count > 1) {
              next[selectedSlot] = { ...slot, count: slot.count - 1 };
            } else {
              next[selectedSlot] = { type: BlockType.AIR, count: 0 };
            }
            return next;
          });
        }
        showNotification(
          `Afiyet olsun! (+${def.hungerRestore} Açlık, +${def.healthRestore} Can) 🍖`
        );
      } else {
        showNotification('Zaten toksun! Açlığın azalınca yiyebilirsin.');
      }
      return;
    }

    // Case 2: Placeable Block -> PLACE!
    if (def?.isPlaceable !== false) {
      const placed = engine.placeBlock(currentSlot.type);
      if (placed) {
        if (engine.player.gameMode === 'survival') {
          setInventory((prev) => {
            const next = [...prev];
            const slot = next[selectedSlot];
            if (slot.count > 1) {
              next[selectedSlot] = { ...slot, count: slot.count - 1 };
            } else {
              next[selectedSlot] = { type: BlockType.AIR, count: 0 };
            }
            return next;
          });
        }
      }
    }
  }, [inventory, selectedSlot, showNotification]);

  // Secondary Action: Mine Block OR Attack Nearby Animal/Mob
  const handleMineOrAttack = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.attackOrMine();
  }, []);

  // Eat food directly from inventory backpack
  const handleEatFoodFromSlot = (slotIndex: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    const slot = inventory[slotIndex];
    if (!slot || slot.count <= 0) return;

    const def = BLOCK_DEFS[slot.type];
    if (!def?.isFood) return;

    const eaten = engine.eatFood(slot.type);
    if (eaten) {
      if (engine.player.gameMode === 'survival') {
        setInventory((prev) => {
          const next = [...prev];
          const s = next[slotIndex];
          if (s.count > 1) {
            next[slotIndex] = { ...s, count: s.count - 1 };
          } else {
            next[slotIndex] = { type: BlockType.AIR, count: 0 };
          }
          return next;
        });
      }
      showNotification(`Yedin! (+${def.hungerRestore} Açlık, +${def.healthRestore} Can) 🍎`);
    } else {
      showNotification('Zaten toksun!');
    }
  };

  // Respawn after death
  const handleRespawn = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.respawn();
    showNotification('✨ Yeniden doğdun! Sağlığın ve açlığın yenilendi.');
  };

  // Build structure at player's target or in front of player
  const handleBuildStructure = (type: 'house' | 'tower' | 'portal' | 'tree') => {
    const engine = engineRef.current;
    if (!engine) return;

    let targetX = 0;
    let targetY = 0;
    let targetZ = 0;

    if (engine.targetBlock) {
      targetX = engine.targetBlock.x;
      targetY = engine.targetBlock.y + 1;
      targetZ = engine.targetBlock.z;
    } else {
      const forwardX = -Math.sin(engine.player.rotation.yaw) * 4;
      const forwardZ = -Math.cos(engine.player.rotation.yaw) * 4;
      targetX = Math.round(engine.player.position.x + forwardX);
      targetZ = Math.round(engine.player.position.z + forwardZ);
      targetY = engine.findHighestBlock(targetX, targetZ) + 1;
    }

    buildStructure(engine.worldBlocks, type, targetX, targetY, targetZ);
    engine.rebuildAllMeshes();
    engine.triggerHandSwing();

    const structureNames: Record<string, string> = {
      house: 'Ahşap Kulübe',
      tower: 'Gözetleme Kulesi',
      portal: 'Nether Portalı',
      tree: 'Büyük Meşe Ağacı',
    };
    showNotification(`${structureNames[type] || 'Yapı'} inşa edildi!`);
  };

  // Load world from Google Drive data
  const handleWorldLoaded = (data: SavedWorldData) => {
    const engine = engineRef.current;
    if (!engine) return;

    const loadedBlocks = new Map<string, BlockType>();
    Object.entries(data.blocks).forEach(([key, val]) => {
      loadedBlocks.set(key, val as BlockType);
    });

    engine.loadWorld(loadedBlocks);

    if (data.playerPosition) {
      engine.player.position.set(
        data.playerPosition[0],
        data.playerPosition[1],
        data.playerPosition[2]
      );
    }
    if (data.playerRotation) {
      engine.player.rotation.yaw = data.playerRotation[0];
      engine.player.rotation.pitch = data.playerRotation[1];
    }
    if (data.gameMode) {
      engine.player.gameMode = data.gameMode;
      setGameMode(data.gameMode);
    }
    if (typeof data.timeOfDay === 'number') {
      engine.timeOfDay = data.timeOfDay;
    }
    if (typeof data.health === 'number') {
      engine.player.health = data.health;
    }
    if (typeof data.hunger === 'number') {
      engine.player.hunger = data.hunger;
    }

    // Restore inventory (support both legacy number[] and InventorySlot[])
    if (data.inventory && Array.isArray(data.inventory)) {
      const restoredInv: InventorySlot[] = data.inventory.map((item: any) => {
        if (typeof item === 'number') {
          return { type: item, count: 64 };
        }
        return {
          type: item.type ?? BlockType.AIR,
          count: item.count ?? 1,
        };
      });

      while (restoredInv.length < INVENTORY_SIZE) {
        restoredInv.push({ type: BlockType.AIR, count: 0 });
      }

      setInventory(restoredInv);
    }

    if (typeof data.selectedSlot === 'number') {
      setSelectedSlot(data.selectedSlot);
    }
  };

  // Generate new random world
  const handleGenerateNewWorld = (seed?: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    const newBlocks = generateWorld(seed);
    engine.loadWorld(newBlocks);
    setInventory(createInitialInventory());
  };

  // Swap item between main hand (inventory[selectedSlot]) and offhand (sol el)
  const handleSwapOffhand = useCallback(() => {
    const mainSlot = inventory[selectedSlot] || { type: BlockType.AIR, count: 0 };
    const tempOffhand = { ...offhandSlot };

    setInventory((prev) => {
      const next = [...prev];
      next[selectedSlot] = tempOffhand;
      return next;
    });
    setOffhandSlot(mainSlot);

    sound.playPickup();
    const mainDef = BLOCK_DEFS[mainSlot.type];
    const offDef = BLOCK_DEFS[tempOffhand.type];
    showNotification(`El Değiştirildi: ${offDef?.nameTr || 'Boş'} ↔ ${mainDef?.nameTr || 'Boş'}`);
  }, [inventory, selectedSlot, offhandSlot, showNotification]);

  // Insert Diamond into Stronghold End Portal Frame (User request: "altta yerleştir butonu")
  const handleInsertDiamondIntoFrame = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.interactWithPortalFrame();
  };

  // Desktop keyboard & mouse controls fallback
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const keysDown = new Set<string>();

    const updateKeyboardMove = () => {
      let forward = 0;
      let right = 0;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) forward += 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) forward -= 1;
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) right += 1;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) right -= 1;

      engine.moveInput.forward = forward;
      engine.moveInput.right = right;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.tagName === 'INPUT' ||
        (e.target as HTMLElement)?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      keysDown.add(e.code);
      updateKeyboardMove();

      if (e.code === 'Space') {
        engine.jump();
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        engine.sneakDown();
      } else if (e.code === 'KeyF') {
        handleSwapOffhand();
      } else if (e.code === 'KeyG') {
        engine.toggleFly();
      } else if (e.code === 'KeyE') {
        setInventoryModalTab('inventory');
        setIsInventoryOpen((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
      updateKeyboardMove();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [engineReady, handleSwapOffhand]);

  // Desktop Mouse Look & Clicks with Hold-to-Mine
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      // Left click = Mine / Attack (Hold to mine blocks, click to attack mobs)
      if (engineRef.current?.attackMob()) return;
      engineRef.current?.startMining();
    } else if (e.button === 2) {
      // Right click = Place or Eat
      handlePlaceOrEat();
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      engineRef.current?.stopMining();
    }
  };

  const activeSlot = inventory[selectedSlot] || { type: BlockType.AIR, count: 0 };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black text-white select-none touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => engineRef.current?.stopMining()}
      />

      {/* Top HUD (Coordinates, Time, Mode, Can & Açlık Barları, Cloud Sync, Settings) */}
      <GameHUD
        engine={engineRef.current}
        onOpenDrive={() => setIsDriveOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenInventory={() => {
          setInventoryModalTab('inventory');
          setIsInventoryOpen(true);
        }}
        notification={notification}
        onRespawn={handleRespawn}
      />

      {/* Mobile Touch Controls (Analog Joystick, Action Buttons: Mine/Attack, Place/Eat, Look Drag) */}
      <TouchControls
        engine={engineRef.current}
        selectedBlock={activeSlot.type}
        onOpenInventory={() => {
          setInventoryModalTab('inventory');
          setIsInventoryOpen(true);
        }}
        touchSensitivity={touchSensitivity}
        onPlaceOrEat={handlePlaceOrEat}
        onMineOrAttack={handleMineOrAttack}
        onStartMining={() => engineRef.current?.startMining()}
        onStopMining={() => engineRef.current?.stopMining()}
        onSwapOffhand={handleSwapOffhand}
        miningProgress={miningProgress}
        isMining={isMining}
        miningBlockType={miningBlockType}
        requiredToolMet={requiredToolMet}
      />

      {/* User requested: Floating "Yerleştir" Button when looking at Stronghold End Portal Frame */}
      {targetedBlockInfo?.blockType === BlockType.END_PORTAL_FRAME && (
        <div className="absolute bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 z-40 pointer-events-auto animate-bounce">
          <button
            onClick={handleInsertDiamondIntoFrame}
            className="px-6 py-3 bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-pixel text-xs sm:text-sm font-bold rounded-xl border-3 border-cyan-300 shadow-[0_0_25px_rgba(77,237,244,0.85)] flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer select-none"
            title="Portal Çerçevesine Elmas Yerleştir"
          >
            <img
              src={getItemIconUrl(BlockType.DIAMOND)}
              alt="Elmas"
              className="w-7 h-7 object-contain drop-shadow"
              style={{ imageRendering: 'pixelated' }}
            />
            <span className="tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              ELMAS YERLEŞTİR
            </span>
          </button>
        </div>
      )}

      {/* Bottom Hotbar (9 slots with item counts + active selector + eat button + offhand slot) */}
      <Hotbar
        slots={inventory}
        selectedSlot={selectedSlot}
        offhandSlot={offhandSlot}
        gameMode={gameMode}
        onSelectSlot={(idx) => setSelectedSlot(idx)}
        onOpenInventory={() => {
          setInventoryModalTab('inventory');
          setIsInventoryOpen(true);
        }}
        onEatFood={handlePlaceOrEat}
        onSwapOffhand={handleSwapOffhand}
      />

      {/* Full 36-slot Inventory & Crafting & Armor Modal */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={() => {
          setIsInventoryOpen(false);
          setInventoryModalTab('inventory');
        }}
        inventory={inventory}
        selectedSlot={selectedSlot}
        offhandSlot={offhandSlot}
        equippedArmor={equippedArmor}
        gameMode={gameMode}
        initialTab={inventoryModalTab}
        onUpdateInventory={setInventory}
        onUpdateOffhand={setOffhandSlot}
        onUpdateArmor={(slotKey, type) =>
          setEquippedArmor((prev) => ({ ...prev, [slotKey]: type }))
        }
        onSelectHotbarSlot={(idx) => setSelectedSlot(idx)}
        onBuildStructure={handleBuildStructure}
        onEatFoodItem={handleEatFoodFromSlot}
        onNotify={showNotification}
      />

      {/* Google Drive Cloud Save & Load Modal */}
      <GoogleDriveModal
        isOpen={isDriveOpen}
        onClose={() => setIsDriveOpen(false)}
        engine={engineRef.current}
        inventory={inventory}
        selectedSlot={selectedSlot}
        onWorldLoaded={handleWorldLoaded}
        onNotify={showNotification}
      />

      {/* Game Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        engine={engineRef.current}
        touchSensitivity={touchSensitivity}
        onUpdateSensitivity={setTouchSensitivity}
        onGenerateNewWorld={handleGenerateNewWorld}
        onNotify={showNotification}
      />
    </div>
  );
}
