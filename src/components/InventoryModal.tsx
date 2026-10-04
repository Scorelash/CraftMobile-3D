import React, { useState } from 'react';
import {
  BlockType,
  BLOCK_DEFS,
  BlockDefinition,
  InventorySlot,
  CRAFTING_RECIPES,
  CraftingRecipe,
} from '../game/constants';
import { getItemIconUrl } from '../game/itemIcons';
import {
  X,
  Search,
  Hammer,
  Backpack,
  Utensils,
  Shield,
  Sparkles,
  Home,
  Castle,
  Flame,
  Trees,
  AlertTriangle,
} from 'lucide-react';
import { sound } from '../game/audio';

export interface EquippedArmorState {
  helmet: BlockType;
  chestplate: BlockType;
  leggings: BlockType;
  boots: BlockType;
}

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventorySlot[];
  selectedSlot: number;
  offhandSlot: InventorySlot;
  equippedArmor: EquippedArmorState;
  gameMode: 'creative' | 'survival';
  initialTab?: 'inventory' | 'craftingTable';
  onUpdateInventory: (newInv: InventorySlot[]) => void;
  onUpdateOffhand: (slot: InventorySlot) => void;
  onUpdateArmor: (slot: keyof EquippedArmorState, type: BlockType) => void;
  onSelectHotbarSlot: (index: number) => void;
  onBuildStructure?: (type: 'house' | 'tower' | 'portal' | 'tree') => void;
  onEatFoodItem?: (slotIndex: number) => void;
  onNotify: (msg: string) => void;
}

type ModalTab = 'inventory' | 'craftingTable' | 'creative' | 'structures';

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  selectedSlot,
  offhandSlot,
  equippedArmor,
  gameMode,
  initialTab = 'inventory',
  onUpdateInventory,
  onUpdateOffhand,
  onUpdateArmor,
  onSelectHotbarSlot,
  onBuildStructure,
  onEatFoodItem,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(
    initialTab === 'craftingTable' ? 'craftingTable' : 'inventory'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvIndex, setSelectedInvIndex] = useState<number>(selectedSlot);

  // Sync tab if initialTab changed when opened
  React.useEffect(() => {
    if (initialTab === 'craftingTable') {
      setActiveTab('craftingTable');
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  // Selected item in backpack / hotbar
  const focusedSlot = inventory[selectedInvIndex] || { type: BlockType.AIR, count: 0 };
  const focusedDef = BLOCK_DEFS[focusedSlot.type];

  // Move or equip focused item to selected active hotbar slot
  const handleEquipToHotbar = () => {
    if (selectedInvIndex === selectedSlot) return;
    const newInv = [...inventory];
    const temp = newInv[selectedSlot];
    newInv[selectedSlot] = newInv[selectedInvIndex];
    newInv[selectedInvIndex] = temp;
    onUpdateInventory(newInv);
    sound.playPickup();
    onNotify(`${focusedDef?.nameTr || 'Eşya'} 1. El Slotuna alındı`);
  };

  // Move focused item to Off-Hand (Sol El)
  const handleEquipToOffhand = () => {
    if (focusedSlot.type === BlockType.AIR) return;
    const oldOffhand = { ...offhandSlot };
    onUpdateOffhand(focusedSlot);
    const newInv = [...inventory];
    newInv[selectedInvIndex] = oldOffhand;
    onUpdateInventory(newInv);
    sound.playPickup();
    onNotify(`${focusedDef?.nameTr || 'Eşya'} Sol Ele Takıldı`);
  };

  // Equip focused item if it is armor
  const handleEquipArmorPiece = () => {
    if (!focusedDef?.isArmor || !focusedDef.armorSlot) return;
    const slotKey = focusedDef.armorSlot;
    if (slotKey === 'shield') {
      handleEquipToOffhand();
      return;
    }

    const currentArmorType = equippedArmor[slotKey];
    onUpdateArmor(slotKey, focusedSlot.type);

    const newInv = [...inventory];
    if (currentArmorType !== BlockType.AIR) {
      newInv[selectedInvIndex] = { type: currentArmorType, count: 1 };
    } else {
      if (focusedSlot.count > 1) {
        newInv[selectedInvIndex] = { type: focusedSlot.type, count: focusedSlot.count - 1 };
      } else {
        newInv[selectedInvIndex] = { type: BlockType.AIR, count: 0 };
      }
    }
    onUpdateInventory(newInv);
    sound.playPickup();
    onNotify(`${focusedDef.nameTr} Kuşanıldı! (Hasar Azaltma: %${Math.round((focusedDef.damageReduction || 0) * 100)})`);
  };

  // Unequip armor piece back to backpack
  const handleUnequipArmor = (slotKey: keyof EquippedArmorState) => {
    const armorType = equippedArmor[slotKey];
    if (armorType === BlockType.AIR) return;

    // Find empty slot in inventory
    const newInv = [...inventory];
    let placed = false;
    for (let i = 0; i < newInv.length; i++) {
      if (newInv[i].type === BlockType.AIR || newInv[i].count === 0) {
        newInv[i] = { type: armorType, count: 1 };
        placed = true;
        break;
      }
    }

    if (!placed) {
      onNotify('Çantan dolu! Çıkarılamadı.');
      return;
    }

    onUpdateArmor(slotKey, BlockType.AIR);
    onUpdateInventory(newInv);
    sound.playPickup();
    onNotify(`${BLOCK_DEFS[armorType]?.nameTr || 'Zırh'} Çıkarıldı`);
  };

  // Unequip offhand item back to inventory
  const handleUnequipOffhand = () => {
    if (offhandSlot.type === BlockType.AIR) return;
    const newInv = [...inventory];
    let placed = false;
    for (let i = 0; i < newInv.length; i++) {
      if (newInv[i].type === BlockType.AIR || newInv[i].count === 0) {
        newInv[i] = { ...offhandSlot };
        placed = true;
        break;
      }
    }
    if (!placed) {
      onNotify('Çantan dolu!');
      return;
    }
    onUpdateOffhand({ type: BlockType.AIR, count: 0 });
    onUpdateInventory(newInv);
    sound.playPickup();
  };

  // Slot click handler
  const handleSlotClick = (index: number) => {
    setSelectedInvIndex(index);
    if (index < 9) {
      onSelectHotbarSlot(index);
    }
  };

  // Eat food from inventory
  const handleEatFromInventory = () => {
    if (onEatFoodItem && focusedDef?.isFood && focusedSlot.count > 0) {
      onEatFoodItem(selectedInvIndex);
    }
  };

  // Check if item in inventory satisfies recipe input
  const isMatchingCraftItem = (requiredType: BlockType, slotType: BlockType): boolean => {
    if (slotType === requiredType) return true;
    if (requiredType === BlockType.DIAMOND || requiredType === BlockType.DIAMOND_ORE) {
      return slotType === BlockType.DIAMOND || slotType === BlockType.DIAMOND_ORE;
    }
    if (requiredType === BlockType.COAL || requiredType === BlockType.COAL_ORE) {
      return slotType === BlockType.COAL || slotType === BlockType.COAL_ORE;
    }
    if (requiredType === BlockType.RAW_IRON || requiredType === BlockType.IRON_ORE) {
      return slotType === BlockType.RAW_IRON || slotType === BlockType.IRON_ORE;
    }
    if (requiredType === BlockType.RAW_GOLD || requiredType === BlockType.GOLD_ORE) {
      return slotType === BlockType.RAW_GOLD || slotType === BlockType.GOLD_ORE;
    }
    if (
      requiredType === BlockType.RAW_COPPER ||
      requiredType === BlockType.COPPER_ORE ||
      requiredType === BlockType.COPPER_INGOT
    ) {
      return (
        slotType === BlockType.RAW_COPPER ||
        slotType === BlockType.COPPER_ORE ||
        slotType === BlockType.COPPER_INGOT
      );
    }
    return false;
  };

  // Crafting check
  const canCraftRecipe = (recipe: CraftingRecipe): boolean => {
    for (const input of recipe.inputs) {
      const totalCount = inventory.reduce((sum, slot) => {
        return isMatchingCraftItem(input.type, slot.type) ? sum + slot.count : sum;
      }, 0);
      if (totalCount < input.count) return false;
    }
    return true;
  };

  const handleCraft = (recipe: CraftingRecipe) => {
    if (!canCraftRecipe(recipe)) {
      onNotify('Yetersiz malzeme!');
      return;
    }

    const newInv = [...inventory];

    // Deduct inputs
    for (const input of recipe.inputs) {
      let needed = input.count;
      for (let i = 0; i < newInv.length; i++) {
        if (isMatchingCraftItem(input.type, newInv[i].type) && needed > 0) {
          const deduct = Math.min(newInv[i].count, needed);
          newInv[i] = {
            ...newInv[i],
            count: newInv[i].count - deduct,
          };
          if (newInv[i].count <= 0) {
            newInv[i] = { type: BlockType.AIR, count: 0 };
          }
          needed -= deduct;
        }
      }
    }

    // Add output
    let added = false;
    for (let i = 0; i < newInv.length; i++) {
      if (newInv[i].type === recipe.output.type && newInv[i].count < 64) {
        newInv[i] = {
          ...newInv[i],
          count: newInv[i].count + recipe.output.count,
        };
        added = true;
        break;
      }
    }
    if (!added) {
      for (let i = 0; i < newInv.length; i++) {
        if (newInv[i].type === BlockType.AIR || newInv[i].count === 0) {
          newInv[i] = {
            type: recipe.output.type,
            count: recipe.output.count,
          };
          added = true;
          break;
        }
      }
    }

    onUpdateInventory(newInv);
    sound.playCraft();
    onNotify(`${recipe.nameTr} üretildi!`);
  };

  // Filter recipes: 2x2 vs 3x3
  const player2x2Recipes = CRAFTING_RECIPES.filter((r) => r.gridType === '2x2');
  const table3x3Recipes = CRAFTING_RECIPES; // Crafting table can craft everything!

  // Creative blocks filter
  const allBlocks = Object.values(BLOCK_DEFS).filter((b) => b.id !== BlockType.AIR);
  const filteredBlocks = allBlocks.filter(
    (b: BlockDefinition) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.nameTr.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 select-none">
      {/* Authentic Minecraft Java GUI Window: #c6c6c6 gray panel with 3D beveled borders */}
      <div
        className="w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden text-neutral-800 shadow-2xl animate-scale-up"
        style={{
          backgroundColor: '#c6c6c6',
          border: '3px solid #000000',
          boxShadow: 'inset 3px 3px 0px #ffffff, inset -3px -3px 0px #555555, 0 10px 30px rgba(0,0,0,0.8)',
        }}
      >
        {/* Minecraft Header Bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b-2 border-[#555555] bg-[#c6c6c6]">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-xs sm:text-sm font-bold text-[#373737] tracking-wider uppercase">
              {activeTab === 'craftingTable'
                ? 'Çalışma Masası (3x3)'
                : activeTab === 'creative'
                ? 'Eşya Listesi (Yaratıcı)'
                : activeTab === 'structures'
                ? 'Hızlı Yapılar'
                : 'Karakter & Envanter'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center bg-[#c6c6c6] text-[#373737] hover:text-black active:scale-95 transition-all"
            style={{
              border: '2px solid #000000',
              boxShadow: 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555',
            }}
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Authentic Minecraft Tabs Bar */}
        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#b0b0b0] border-b-2 border-[#555555] overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1 text-xs font-pixel font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'bg-[#c6c6c6] text-black shadow-inner'
                : 'bg-[#999999] text-neutral-800 hover:bg-[#a6a6a6]'
            }`}
            style={{
              border: '2px solid #000000',
              boxShadow:
                activeTab === 'inventory'
                  ? 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555'
                  : 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px #555555',
            }}
          >
            <Backpack className="w-3.5 h-3.5" />
            Envanter (2x2)
          </button>

          <button
            onClick={() => setActiveTab('craftingTable')}
            className={`px-3 py-1 text-xs font-pixel font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'craftingTable'
                ? 'bg-[#c6c6c6] text-black shadow-inner'
                : 'bg-[#999999] text-neutral-800 hover:bg-[#a6a6a6]'
            }`}
            style={{
              border: '2px solid #000000',
              boxShadow:
                activeTab === 'craftingTable'
                  ? 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555'
                  : 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px #555555',
            }}
          >
            <Hammer className="w-3.5 h-3.5 text-amber-800" />
            Çalışma Masası (3x3 Kazma)
          </button>

          <button
            onClick={() => setActiveTab('creative')}
            className={`px-3 py-1 text-xs font-pixel font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'creative'
                ? 'bg-[#c6c6c6] text-black shadow-inner'
                : 'bg-[#999999] text-neutral-800 hover:bg-[#a6a6a6]'
            }`}
            style={{
              border: '2px solid #000000',
              boxShadow:
                activeTab === 'creative'
                  ? 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555'
                  : 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px #555555',
            }}
          >
            Tüm Bloklar
          </button>

          <button
            onClick={() => setActiveTab('structures')}
            className={`px-3 py-1 text-xs font-pixel font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'structures'
                ? 'bg-[#c6c6c6] text-purple-900 shadow-inner'
                : 'bg-[#999999] text-neutral-800 hover:bg-[#a6a6a6]'
            }`}
            style={{
              border: '2px solid #000000',
              boxShadow:
                activeTab === 'structures'
                  ? 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555'
                  : 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px #555555',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
            Yapılar
          </button>
        </div>

        {/* Tab 1: Authentic Minecraft Player Inventory + 2x2 Crafting */}
        {activeTab === 'inventory' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {/* Top Half: Armor Slots + 3D Player Steve Box + Sol El (Off-Hand) + 2x2 Crafting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-[#b8b8b8] border-2 border-[#555555]">
              {/* Left Column: 4 Armor Slots + Steve Avatar + Off-Hand Slot */}
              <div className="flex items-center gap-3">
                {/* 4 Armor Slots Stacked Vertically */}
                <div className="flex flex-col gap-1.5">
                  {(['helmet', 'chestplate', 'leggings', 'boots'] as const).map((slotKey) => {
                    const armorType = equippedArmor[slotKey];
                    const hasArmor = armorType !== BlockType.AIR;
                    const def = hasArmor ? BLOCK_DEFS[armorType] : null;

                    return (
                      <div
                        key={slotKey}
                        onClick={() => hasArmor && handleUnequipArmor(slotKey)}
                        className={`relative w-10 h-10 flex items-center justify-center cursor-pointer transition-colors ${
                          hasArmor ? 'hover:brightness-110' : 'opacity-70'
                        }`}
                        title={
                          hasArmor
                            ? `${def?.nameTr} (Çıkarmak için tıkla)`
                            : slotKey === 'helmet'
                            ? 'Kask Yuvası'
                            : slotKey === 'chestplate'
                            ? 'Zırh Yuvası'
                            : slotKey === 'leggings'
                            ? 'Pantolon Yuvası'
                            : 'Bot Yuvası'
                        }
                        style={{
                          backgroundColor: '#8b8b8b',
                          border: '2px solid #373737',
                          borderRightColor: '#ffffff',
                          borderBottomColor: '#ffffff',
                        }}
                      >
                        {hasArmor ? (
                          <img
                            src={getItemIconUrl(armorType)}
                            alt=""
                            className="w-7 h-7 object-contain drop-shadow"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        ) : (
                          <Shield className="w-5 h-5 text-[#555555]" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Steve Character Figure Box */}
                <div
                  className="flex-1 h-44 flex flex-col items-center justify-center p-2 relative"
                  style={{
                    backgroundColor: '#8b8b8b',
                    border: '2px solid #373737',
                    borderRightColor: '#ffffff',
                    borderBottomColor: '#ffffff',
                  }}
                >
                  <div className="text-[10px] font-pixel text-[#222222] font-bold absolute top-1 left-2">
                    STEVE
                  </div>

                  {/* 2D/3D Minecraft Steve Avatar Representation */}
                  <div className="flex flex-col items-center">
                    {/* Head */}
                    <div
                      className="w-10 h-10 rounded-xs border border-black/40 relative shadow-sm"
                      style={{
                        backgroundColor: '#c48a60',
                        boxShadow: equippedArmor.helmet !== BlockType.AIR ? '0 0 0 2px #4dedf4' : 'none',
                      }}
                    >
                      {/* Hair */}
                      <div className="w-full h-3 bg-[#4a3018]" />
                      {/* Eyes */}
                      <div className="flex justify-between px-1.5 mt-1">
                        <div className="w-1.5 h-1.5 bg-blue-700" />
                        <div className="w-1.5 h-1.5 bg-blue-700" />
                      </div>
                    </div>

                    {/* Torso & Arms */}
                    <div className="flex gap-1 mt-1">
                      {/* Left Arm / Off-hand holding indicator */}
                      <div
                        className="w-3.5 h-14 rounded-xs border border-black/30"
                        style={{ backgroundColor: '#00a8a8' }}
                      />
                      {/* Torso with chestplate highlight */}
                      <div
                        className="w-10 h-14 rounded-xs border border-black/30 flex items-center justify-center relative"
                        style={{
                          backgroundColor:
                            equippedArmor.chestplate === BlockType.DIAMOND_CHESTPLATE
                              ? '#4dedf4'
                              : equippedArmor.chestplate === BlockType.IRON_CHESTPLATE
                              ? '#d8d8d8'
                              : '#00a8a8',
                        }}
                      >
                        {equippedArmor.chestplate !== BlockType.AIR && (
                          <Shield className="w-5 h-5 text-black/40" />
                        )}
                      </div>
                      {/* Right Arm */}
                      <div
                        className="w-3.5 h-14 rounded-xs border border-black/30"
                        style={{ backgroundColor: '#00a8a8' }}
                      />
                    </div>

                    {/* Legs */}
                    <div className="flex gap-1 mt-0.5">
                      <div
                        className="w-4.5 h-12 rounded-xs border border-black/30"
                        style={{
                          backgroundColor:
                            equippedArmor.leggings === BlockType.DIAMOND_LEGGINGS
                              ? '#4dedf4'
                              : '#2b3b7a',
                        }}
                      />
                      <div
                        className="w-4.5 h-12 rounded-xs border border-black/30"
                        style={{
                          backgroundColor:
                            equippedArmor.leggings === BlockType.DIAMOND_LEGGINGS
                              ? '#4dedf4'
                              : '#2b3b7a',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Sol El (Off-Hand / Shield Slot) */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-pixel font-bold text-[#373737]">SOL EL</span>
                  <div
                    onClick={handleUnequipOffhand}
                    className="relative w-11 h-11 flex items-center justify-center cursor-pointer hover:brightness-110"
                    title={
                      offhandSlot.type !== BlockType.AIR
                        ? `${BLOCK_DEFS[offhandSlot.type]?.nameTr} (Sol El - Çıkarmak için tıkla)`
                        : 'Sol El (Meşale, Kalkan veya Blok takılabilir - Kısayol F)'
                    }
                    style={{
                      backgroundColor: '#8b8b8b',
                      border: '2px solid #373737',
                      borderRightColor: '#ffffff',
                      borderBottomColor: '#ffffff',
                    }}
                  >
                    {offhandSlot.type !== BlockType.AIR ? (
                      <>
                        <img
                          src={getItemIconUrl(offhandSlot.type)}
                          alt=""
                          className="w-8 h-8 object-contain drop-shadow"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        {offhandSlot.count > 1 && (
                          <span className="absolute bottom-0.5 right-1 text-[9px] font-pixel font-bold text-white drop-shadow-[1px_1px_0px_#000]">
                            {offhandSlot.count}
                          </span>
                        )}
                      </>
                    ) : (
                      <Shield className="w-5 h-5 text-[#555555]" />
                    )}
                  </div>
                  <span className="text-[8px] font-mono text-neutral-600 font-bold">F Tuşu</span>
                </div>
              </div>

              {/* Right Column: 2x2 Crafting Grid (Üretim) */}
              <div className="flex flex-col justify-between p-2 bg-[#b0b0b0] border border-[#777777]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-pixel text-[11px] font-bold text-[#373737] uppercase">
                    ÜRETİM (2x2)
                  </span>
                  <span className="text-[10px] text-amber-900 font-bold">
                    Temel Üretim
                  </span>
                </div>

                {/* Explicit notice about pickaxes needing crafting table */}
                <div className="bg-amber-100 border border-amber-400 p-1.5 rounded-xs text-[10px] text-amber-900 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>Kazma & Silah Yapımı:</strong> Sadece <strong>Çalışma Masası</strong> ile yapılabilir!
                  </span>
                </div>

                {/* 2x2 Fast Recipes Grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {player2x2Recipes.map((recipe) => {
                    const canCraft = canCraftRecipe(recipe);

                    return (
                      <button
                        key={recipe.id}
                        onClick={() => handleCraft(recipe)}
                        disabled={!canCraft}
                        className={`p-1.5 flex items-center gap-2 transition-all ${
                          canCraft
                            ? 'bg-[#c6c6c6] hover:bg-[#d4d4d4] active:scale-95 cursor-pointer'
                            : 'bg-[#9e9e9e] opacity-60 cursor-not-allowed'
                        }`}
                        style={{
                          border: '2px solid #000000',
                          boxShadow: canCraft
                            ? 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px #555555'
                            : 'none',
                        }}
                      >
                        <div
                          className="w-8 h-8 flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: '#8b8b8b',
                            border: '1px solid #373737',
                          }}
                        >
                          <img
                            src={getItemIconUrl(recipe.output.type)}
                            alt=""
                            className="w-6 h-6 object-contain"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                        <div className="text-left overflow-hidden">
                          <div className="font-pixel text-[10px] font-bold text-[#222222] truncate">
                            {recipe.nameTr}
                          </div>
                          <div className="text-[9px] text-[#444444] truncate">
                            {recipe.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Focused Item Quick Action Bar */}
            <div
              className="p-2 flex items-center justify-between"
              style={{
                backgroundColor: '#b8b8b8',
                border: '2px solid #555555',
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 flex items-center justify-center p-1"
                  style={{
                    backgroundColor: '#8b8b8b',
                    border: '2px solid #373737',
                    borderRightColor: '#ffffff',
                    borderBottomColor: '#ffffff',
                  }}
                >
                  {focusedDef && focusedSlot.type !== BlockType.AIR ? (
                    <img
                      src={getItemIconUrl(focusedSlot.type)}
                      alt=""
                      className="w-8 h-8 object-contain drop-shadow"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-[#555555]" />
                  )}
                </div>
                <div>
                  <div className="font-pixel text-xs font-bold text-[#111111] flex items-center gap-2">
                    {focusedDef?.nameTr || 'Boş Yuva'}
                    {focusedSlot.count > 0 && (
                      <span className="text-[11px] text-[#333333]">
                        ({focusedSlot.count} adet)
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#555555]">
                    {focusedDef?.isArmor
                      ? `Zırh Parçası (%${Math.round((focusedDef.damageReduction || 0) * 100)} Koruma)`
                      : focusedDef?.isTool
                      ? `Alet / Silah (${focusedDef.attackDamage || 1} Hasar)`
                      : focusedDef?.isFood
                      ? `Yiyecek (+${focusedDef.hungerRestore} Açlık)`
                      : 'Eşya / Blok'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                {focusedDef?.isFood && focusedSlot.count > 0 && (
                  <button
                    onClick={handleEatFromInventory}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-pixel text-[10px] flex items-center gap-1 shadow"
                    style={{ border: '1px solid #000' }}
                  >
                    <Utensils className="w-3 h-3" />
                    Ye
                  </button>
                )}

                {focusedDef?.isArmor && focusedSlot.count > 0 && (
                  <button
                    onClick={handleEquipArmorPiece}
                    className="px-2.5 py-1 bg-blue-700 hover:bg-blue-600 text-white font-pixel text-[10px] flex items-center gap-1 shadow"
                    style={{ border: '1px solid #000' }}
                  >
                    <Shield className="w-3 h-3" />
                    Zırhı Giy
                  </button>
                )}

                {focusedSlot.type !== BlockType.AIR && (
                  <button
                    onClick={handleEquipToOffhand}
                    className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 text-white font-pixel text-[10px] flex items-center gap-1 shadow"
                    style={{ border: '1px solid #000' }}
                    title="Sol ele tak (Meşale, Kalkan, vs.)"
                  >
                    Sol Ele Ver
                  </button>
                )}

                {focusedSlot.type !== BlockType.AIR && (
                  <button
                    onClick={handleEquipToHotbar}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-black font-pixel text-[10px] font-bold flex items-center gap-1 shadow"
                    style={{ border: '1px solid #000' }}
                  >
                    Hotbar'a Al
                  </button>
                )}
              </div>
            </div>

            {/* Main Backpack (27 slots = 3 rows of 9) */}
            <div>
              <div className="font-pixel text-[11px] font-bold text-[#373737] uppercase tracking-wider mb-1">
                Çanta (27 Yuva)
              </div>
              <div
                className="grid grid-cols-9 gap-1 p-2"
                style={{
                  backgroundColor: '#8b8b8b',
                  border: '2px solid #373737',
                  borderRightColor: '#ffffff',
                  borderBottomColor: '#ffffff',
                }}
              >
                {inventory.slice(9, 36).map((slot, i) => {
                  const actualIdx = i + 9;
                  const isSelected = selectedInvIndex === actualIdx;
                  const def = BLOCK_DEFS[slot.type];
                  const hasItem = def && slot.type !== BlockType.AIR && slot.count > 0;

                  return (
                    <button
                      key={actualIdx}
                      onClick={() => handleSlotClick(actualIdx)}
                      className={`relative aspect-square flex items-center justify-center transition-all ${
                        isSelected
                          ? 'ring-2 ring-amber-400 bg-[#a0a0a0]'
                          : 'hover:bg-[#999999]'
                      }`}
                      style={{
                        backgroundColor: '#8b8b8b',
                        border: '2px solid #373737',
                        borderRightColor: '#ffffff',
                        borderBottomColor: '#ffffff',
                      }}
                    >
                      {hasItem && (
                        <img
                          src={getItemIconUrl(slot.type)}
                          alt={def.nameTr}
                          className="w-4/5 h-4/5 object-contain pointer-events-none drop-shadow"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                      {hasItem && (
                        <span className="absolute bottom-0 right-1 text-[9px] font-pixel font-bold text-white drop-shadow-[1px_1px_0px_#000]">
                          {slot.count > 1 ? slot.count : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Hotbar (9 slots) */}
            <div>
              <div className="font-pixel text-[11px] font-bold text-[#373737] uppercase tracking-wider mb-1 flex justify-between">
                <span>Hızlı Erişim Çubuğu (Hotbar)</span>
                <span className="text-[10px] text-[#555555]">Aktif: {selectedSlot + 1}</span>
              </div>
              <div
                className="grid grid-cols-9 gap-1 p-2"
                style={{
                  backgroundColor: '#8b8b8b',
                  border: '2px solid #373737',
                  borderRightColor: '#ffffff',
                  borderBottomColor: '#ffffff',
                }}
              >
                {inventory.slice(0, 9).map((slot, actualIdx) => {
                  const isSelected = selectedInvIndex === actualIdx;
                  const isCurrentActive = selectedSlot === actualIdx;
                  const def = BLOCK_DEFS[slot.type];
                  const hasItem = def && slot.type !== BlockType.AIR && slot.count > 0;

                  return (
                    <button
                      key={actualIdx}
                      onClick={() => handleSlotClick(actualIdx)}
                      className={`relative aspect-square flex items-center justify-center transition-all ${
                        isCurrentActive
                          ? 'ring-2 ring-white bg-[#b5b5b5]'
                          : isSelected
                          ? 'ring-2 ring-amber-400 bg-[#a0a0a0]'
                          : 'hover:bg-[#999999]'
                      }`}
                      style={{
                        backgroundColor: '#8b8b8b',
                        border: '2px solid #373737',
                        borderRightColor: '#ffffff',
                        borderBottomColor: '#ffffff',
                      }}
                    >
                      <span className="absolute top-0.5 left-1 text-[7px] font-pixel text-[#444444]">
                        {actualIdx + 1}
                      </span>
                      {hasItem && (
                        <img
                          src={getItemIconUrl(slot.type)}
                          alt={def.nameTr}
                          className="w-4/5 h-4/5 object-contain pointer-events-none drop-shadow"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      )}
                      {hasItem && (
                        <span className="absolute bottom-0 right-1 text-[9px] font-pixel font-bold text-white drop-shadow-[1px_1px_0px_#000]">
                          {slot.count > 1 ? slot.count : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: 3x3 Advanced Crafting Table (KAZMALAR & SİLAHLAR BURADA ÜRETİLİR!) */}
        {activeTab === 'craftingTable' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            <div
              className="p-2.5 bg-amber-50 border-2 border-amber-600 rounded-xs text-xs text-amber-900 font-pixel font-bold flex items-center gap-2"
            >
              <Hammer className="w-5 h-5 text-amber-700 shrink-0" />
              <span>
                🛠️ <strong>Çalışma Masası (3x3):</strong> Kazmalar, Kılıçlar, Baltalar ve Zırhlar SADECE burada üretilebilir!
              </span>
            </div>

            {/* List of 3x3 recipes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {table3x3Recipes.map((recipe) => {
                const canCraft = canCraftRecipe(recipe);
                const outDef = BLOCK_DEFS[recipe.output.type];

                return (
                  <div
                    key={recipe.id}
                    className={`p-2.5 flex flex-col justify-between transition-colors ${
                      canCraft ? 'bg-[#c6c6c6]' : 'bg-[#a8a8a8] opacity-75'
                    }`}
                    style={{
                      border: '2px solid #000000',
                      boxShadow: 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555',
                    }}
                  >
                    <div>
                      {/* Title & icon */}
                      <div className="flex items-center gap-2.5 mb-2">
                        <div
                          className="w-10 h-10 flex items-center justify-center p-1 shrink-0"
                          style={{
                            backgroundColor: '#8b8b8b',
                            border: '2px solid #373737',
                            borderRightColor: '#ffffff',
                            borderBottomColor: '#ffffff',
                          }}
                        >
                          <img
                            src={getItemIconUrl(recipe.output.type)}
                            alt=""
                            className="w-8 h-8 object-contain drop-shadow"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                        <div>
                          <div className="font-pixel text-xs font-bold text-[#111111]">
                            {recipe.nameTr}
                          </div>
                          <div className="text-[10px] text-[#444444]">
                            {recipe.description}
                          </div>
                        </div>
                      </div>

                      {/* Required inputs */}
                      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#9e9e9e] border border-[#777777] text-[10px] font-bold text-[#111111]">
                        <span className="text-[#333333]">Gereken:</span>
                        {recipe.inputs.map((inp, idx) => {
                          const inpDef = BLOCK_DEFS[inp.type];
                          return (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-[#b5b5b5] px-1.5 py-0.5 border border-[#555555]"
                            >
                              <img
                                src={getItemIconUrl(inp.type)}
                                alt=""
                                className="w-3.5 h-3.5 object-contain"
                                style={{ imageRendering: 'pixelated' }}
                              />
                              {inp.count}x {inpDef?.nameTr || inpDef?.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCraft(recipe)}
                      disabled={!canCraft}
                      className={`mt-2 py-1.5 font-pixel text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        canCraft
                          ? 'bg-amber-600 hover:bg-amber-500 text-black active:scale-95 cursor-pointer'
                          : 'bg-[#7e7e7e] text-[#444444] cursor-not-allowed'
                      }`}
                      style={{
                        border: '2px solid #000000',
                        boxShadow: canCraft
                          ? 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555'
                          : 'none',
                      }}
                    >
                      <Hammer className="w-3.5 h-3.5" />
                      {canCraft ? 'Masada Üret' : 'Eksik Malzeme'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Creative / All Blocks Palette */}
        {activeTab === 'creative' && (
          <div className="flex-1 flex flex-col overflow-hidden p-3">
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-neutral-600 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Blok veya eşya ara (Elmas, Meşale, Kask, Kazma, Ekmek...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-[#8b8b8b] text-black font-pixel text-xs placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                style={{
                  border: '2px solid #373737',
                  borderRightColor: '#ffffff',
                  borderBottomColor: '#ffffff',
                }}
              />
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-1.5 p-1 bg-[#8b8b8b] border-2 border-[#373737]">
              {filteredBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => {
                    const newInv = [...inventory];
                    newInv[selectedInvIndex] = {
                      type: block.id,
                      count: 64,
                    };
                    onUpdateInventory(newInv);
                    sound.playPickup();
                    onNotify(`${block.nameTr} eklendi`);
                  }}
                  className="flex flex-col items-center p-1.5 bg-[#c6c6c6] hover:bg-[#d8d8d8] active:scale-95 transition-all text-center"
                  style={{
                    border: '1px solid #000000',
                    boxShadow: 'inset 1px 1px 0px #ffffff, inset -1px -1px 0px #555555',
                  }}
                >
                  <div className="w-8 h-8 flex items-center justify-center p-1">
                    <img
                      src={getItemIconUrl(block.id)}
                      alt={block.nameTr}
                      className="w-7 h-7 object-contain drop-shadow"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                  <span className="mt-1 text-[9px] font-pixel font-bold text-[#222222] line-clamp-1">
                    {block.nameTr}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Quick Structures */}
        {activeTab === 'structures' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className="p-3 bg-[#c6c6c6] flex flex-col justify-between"
                style={{
                  border: '2px solid #000000',
                  boxShadow: 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-800/20 flex items-center justify-center text-amber-800 border border-amber-800">
                    <Home className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-xs font-bold text-[#111111]">Ahşap Kulübe</h4>
                    <p className="text-[10px] text-[#444444]">Pencereler, meşaleler & çalışma masası</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onBuildStructure?.('house');
                    onClose();
                  }}
                  className="mt-3 w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-pixel text-xs font-bold"
                  style={{ border: '2px solid #000' }}
                >
                  Buraya İnşa Et
                </button>
              </div>

              <div
                className="p-3 bg-[#c6c6c6] flex flex-col justify-between"
                style={{
                  border: '2px solid #000000',
                  boxShadow: 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-700/20 flex items-center justify-center text-stone-800 border border-stone-800">
                    <Castle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-xs font-bold text-[#111111]">Gözetleme Kulesi</h4>
                    <p className="text-[10px] text-[#444444]">Kırıktaş burçlu 8 blok kule</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onBuildStructure?.('tower');
                    onClose();
                  }}
                  className="mt-3 w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-pixel text-xs font-bold"
                  style={{ border: '2px solid #000' }}
                >
                  Buraya İnşa Et
                </button>
              </div>

              <div
                className="p-3 bg-[#c6c6c6] flex flex-col justify-between"
                style={{
                  border: '2px solid #000000',
                  boxShadow: 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-700/20 flex items-center justify-center text-purple-900 border border-purple-900">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-xs font-bold text-[#111111]">Nether Portalı</h4>
                    <p className="text-[10px] text-[#444444]">4x5 obsidyen portal çerçevesi</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onBuildStructure?.('portal');
                    onClose();
                  }}
                  className="mt-3 w-full py-1.5 bg-purple-700 hover:bg-purple-600 text-white font-pixel text-xs font-bold"
                  style={{ border: '2px solid #000' }}
                >
                  Buraya İnşa Et
                </button>
              </div>

              <div
                className="p-3 bg-[#c6c6c6] flex flex-col justify-between"
                style={{
                  border: '2px solid #000000',
                  boxShadow: 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-700/20 flex items-center justify-center text-emerald-900 border border-emerald-900">
                    <Trees className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-pixel text-xs font-bold text-[#111111]">Büyük Meşe Ağacı</h4>
                    <p className="text-[10px] text-[#444444]">Geniş yapraklı doğal meşe ağacı</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onBuildStructure?.('tree');
                    onClose();
                  }}
                  className="mt-3 w-full py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-pixel text-xs font-bold"
                  style={{ border: '2px solid #000' }}
                >
                  Buraya Dik
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-2 border-t-2 border-[#555555] bg-[#c6c6c6] flex items-center justify-between text-[11px] font-pixel text-[#373737]">
          <span>İpucu: Kazma üretmek için Çalışma Masası sekmesini açın.</span>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#c6c6c6] hover:bg-[#d8d8d8] text-black font-pixel font-bold active:scale-95"
            style={{
              border: '2px solid #000000',
              boxShadow: 'inset 2px 2px 0px #ffffff, inset -2px -2px 0px #555555',
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
