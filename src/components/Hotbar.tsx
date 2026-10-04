import React, { useEffect } from 'react';
import { BlockType, BLOCK_DEFS, InventorySlot } from '../game/constants';
import { getItemIconUrl } from '../game/itemIcons';
import { Package, Utensils, Shield } from 'lucide-react';

interface HotbarProps {
  slots: InventorySlot[];
  selectedSlot: number;
  offhandSlot?: InventorySlot;
  gameMode: 'creative' | 'survival';
  onSelectSlot: (index: number) => void;
  onOpenInventory: () => void;
  onEatFood: () => void;
  onSwapOffhand?: () => void;
}

export const Hotbar: React.FC<HotbarProps> = ({
  slots,
  selectedSlot,
  offhandSlot,
  gameMode,
  onSelectSlot,
  onOpenInventory,
  onEatFood,
  onSwapOffhand,
}) => {
  // Listen for number keys 1-9 for desktop users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        onSelectSlot(num - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectSlot]);

  const activeSlot = slots[selectedSlot] || { type: BlockType.AIR, count: 0 };
  const activeBlockDef = BLOCK_DEFS[activeSlot.type];
  const isFood = activeBlockDef?.isFood && activeSlot.count > 0;

  const hasOffhand = offhandSlot && offhandSlot.type !== BlockType.AIR && offhandSlot.count > 0;
  const offhandDef = hasOffhand ? BLOCK_DEFS[offhandSlot.type] : null;

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-30 pointer-events-auto">
      {/* Selected Block Info & Quick Eat Button */}
      <div className="flex items-center gap-2">
        {activeBlockDef && activeSlot.type !== BlockType.AIR && (
          <div className="bg-black/85 backdrop-blur-xs px-3 py-1 rounded text-white text-[11px] font-bold tracking-wide shadow-md border border-white/15 uppercase flex items-center gap-2 animate-fade-in">
            <img
              src={getItemIconUrl(activeSlot.type)}
              alt=""
              className="w-4 h-4 object-contain pointer-events-none"
              style={{ imageRendering: 'pixelated' }}
            />
            <span>{activeBlockDef.nameTr || activeBlockDef.name}</span>
            {activeBlockDef.isTool && activeBlockDef.toolType === 'pickaxe' && (
              <span className="text-[10px] text-cyan-400 font-mono">
                {activeBlockDef.toolTier === 1 && '(Taş & Kömür)'}
                {activeBlockDef.toolTier === 2 && '(Demir Kazar)'}
                {activeBlockDef.toolTier === 3 && '(Elmas & Altın Kazar)'}
                {activeBlockDef.toolTier === 4 && '(Obsidyen & Her Şey)'}
              </span>
            )}
            {activeBlockDef.isTool && activeBlockDef.attackDamage && (
              <span className="text-[10px] text-amber-300 font-mono">
                (+{activeBlockDef.attackDamage} Hasar)
              </span>
            )}
            {isFood && (
              <span className="text-[10px] text-amber-400 font-mono">
                (+{activeBlockDef.hungerRestore} Açlık)
              </span>
            )}
          </div>
        )}

        {/* Quick Eat Button for Mobile & Desktop when holding food */}
        {isFood && (
          <button
            onClick={onEatFood}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-pixel rounded-lg shadow-lg border border-emerald-400 flex items-center gap-1.5 transition-transform"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>YE</span>
          </button>
        )}
      </div>

      {/* Main Bar: Sol El (Off-Hand) + 9 Hotbar Slots + Inventory Button */}
      <div className="flex items-center gap-1.5">
        {/* Sol El (Off-Hand / Left Hand Slot) */}
        {offhandSlot && (
          <button
            onClick={onSwapOffhand}
            className="relative w-10 h-10 sm:w-11 sm:h-11 rounded bg-neutral-900/90 border-2 border-amber-500/70 hover:border-amber-400 flex items-center justify-center transition-all shadow-xl mr-1"
            title="Sol El / Off-Hand (Değiştirmek için tıkla veya F'ye bas)"
          >
            <span className="absolute top-0.5 left-1 text-[7px] font-pixel font-bold text-amber-400 select-none">
              F
            </span>
            {hasOffhand ? (
              <>
                <img
                  src={getItemIconUrl(offhandSlot.type)}
                  alt={offhandDef?.nameTr}
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none drop-shadow select-none"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="absolute bottom-0.5 right-1 text-[9px] font-bold font-pixel text-white drop-shadow-[0_1px_2px_#000]">
                  {gameMode === 'creative' ? '∞' : offhandSlot.count > 1 ? offhandSlot.count : ''}
                </span>
              </>
            ) : (
              <Shield className="w-5 h-5 text-neutral-500" />
            )}
          </button>
        )}

        {/* 9 Hotbar Slots + Inventory Button */}
        <div className="flex items-center gap-1 p-1 bg-neutral-900/90 border-2 border-neutral-700/80 rounded-lg shadow-2xl backdrop-blur-md">
          {slots.slice(0, 9).map((slot, idx) => {
            const isSelected = selectedSlot === idx;
            const def = BLOCK_DEFS[slot.type];
            const hasItem = def && slot.type !== BlockType.AIR && slot.count > 0;

            return (
              <button
                key={idx}
                onClick={() => onSelectSlot(idx)}
                className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-neutral-700 border-2 border-white scale-105 shadow-[0_0_10px_rgba(255,255,255,0.4)] z-10'
                    : 'bg-neutral-800/80 border border-neutral-600/70 hover:bg-neutral-750'
                }`}
              >
                {/* Slot Index Number */}
                <span className="absolute top-0.5 left-1 text-[8px] font-pixel text-neutral-400 select-none">
                  {idx + 1}
                </span>

                {/* Block / Item 3D-styled preview - EXACT MINECRAFT ISOMETRIC & PIXEL ART */}
                {hasItem ? (
                  <img
                    src={getItemIconUrl(slot.type)}
                    alt={def.nameTr}
                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain pointer-events-none drop-shadow select-none"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : null}

                {/* Item Count Badge */}
                {hasItem && (
                  <span className="absolute bottom-0.5 right-1 text-[9px] font-bold font-pixel text-white drop-shadow-[0_1px_2px_#000]">
                    {gameMode === 'creative' ? '∞' : slot.count > 1 ? slot.count : ''}
                  </span>
                )}
              </button>
            );
          })}

          {/* Full Inventory Drawer Button */}
          <button
            onClick={onOpenInventory}
            className="w-10 h-10 sm:w-11 sm:h-11 ml-1 rounded bg-neutral-800 border border-amber-500/60 hover:bg-neutral-700 flex flex-col items-center justify-center text-amber-400 active:scale-95 transition-all shadow-md"
            title="Envanter & Üretim (E)"
          >
            <Package className="w-5 h-5" />
            <span className="text-[8px] font-bold">E</span>
          </button>
        </div>
      </div>
    </div>
  );
};
