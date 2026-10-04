import React, { useRef, useState, useEffect } from 'react';
import { VoxelGameEngine } from '../game/engine';
import { Pickaxe, ShieldAlert, ArrowUp, ArrowDown, Feather, SquarePlus, Utensils, Shield } from 'lucide-react';
import { BlockType, BLOCK_DEFS } from '../game/constants';

interface TouchControlsProps {
  engine: VoxelGameEngine | null;
  selectedBlock: BlockType;
  onOpenInventory: () => void;
  touchSensitivity?: number;
  onPlaceOrEat: () => void;
  onMineOrAttack: () => void;
  onStartMining?: () => void;
  onStopMining?: () => void;
  onSwapOffhand?: () => void;
  miningProgress?: number;
  isMining?: boolean;
  miningBlockType?: BlockType | null;
  requiredToolMet?: boolean;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  engine,
  selectedBlock,
  touchSensitivity = 1.0,
  onPlaceOrEat,
  onMineOrAttack,
  onStartMining,
  onStopMining,
  onSwapOffhand,
  miningProgress = 0,
  isMining = false,
  miningBlockType = null,
  requiredToolMet = true,
}) => {
  // Joystick state
  const joystickContainerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState(false);
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef({ x: 0, y: 0 });

  // Look touch drag state
  const lookAreaRef = useRef<HTMLDivElement>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef({ x: 0, y: 0 });

  // Sprint toggle
  const [isSprinting, setIsSprinting] = useState(false);

  // Flight state
  const [isFlying, setIsFlying] = useState(false);

  useEffect(() => {
    if (engine) {
      setIsFlying(engine.player.isFlying);
    }
  }, [engine?.player.isFlying]);

  // Handle Joystick touch events
  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (joystickTouchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchIdRef.current = touch.identifier;

    if (joystickContainerRef.current) {
      const rect = joystickContainerRef.current.getBoundingClientRect();
      joystickCenterRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    setIsJoystickActive(true);
    updateJoystickPos(touch.clientX, touch.clientY);
  };

  const handleJoystickTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        updateJoystickPos(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const updateJoystickPos = (clientX: number, clientY: number) => {
    const maxRadius = 45;
    const dx = clientX - joystickCenterRef.current.x;
    const dy = clientY - joystickCenterRef.current.y;
    const distance = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (distance > maxRadius) {
      clampedX = (dx / distance) * maxRadius;
      clampedY = (dy / distance) * maxRadius;
    }

    setKnobPos({ x: clampedX, y: clampedY });

    if (engine) {
      // Forward is negative Y in screen coordinates
      const normY = -clampedY / maxRadius;
      const normX = clampedX / maxRadius;
      engine.moveInput.forward = Math.abs(normY) > 0.15 ? normY : 0;
      engine.moveInput.right = Math.abs(normX) > 0.15 ? normX : 0;
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setIsJoystickActive(false);
        setKnobPos({ x: 0, y: 0 });
        if (engine) {
          engine.moveInput.forward = 0;
          engine.moveInput.right = 0;
        }
        break;
      }
    }
  };

  // Handle Look drag touch events on right screen half
  const handleLookTouchStart = (e: React.TouchEvent) => {
    if (lookTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchIdRef.current = touch.identifier;
    lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const dx = touch.clientX - lastLookPosRef.current.x;
        const dy = touch.clientY - lastLookPosRef.current.y;
        lastLookPosRef.current = { x: touch.clientX, y: touch.clientY };

        if (engine) {
          const sens = 0.0045 * touchSensitivity;
          engine.player.rotation.yaw -= dx * sens;
          engine.player.rotation.pitch -= dy * sens;

          // Clamp vertical pitch to prevent gimbal lock
          const maxPitch = Math.PI / 2 - 0.05;
          engine.player.rotation.pitch = Math.max(
            -maxPitch,
            Math.min(maxPitch, engine.player.rotation.pitch)
          );
        }
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        break;
      }
    }
  };

  // Toggle sprint
  const toggleSprint = () => {
    if (!engine) return;
    const next = !isSprinting;
    setIsSprinting(next);
    engine.player.isSprinting = next;
  };

  // Toggle fly mode (creative)
  const handleToggleFly = () => {
    if (!engine) return;
    engine.toggleFly();
    setIsFlying(engine.player.isFlying);
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-20">
      {/* Right-half Look / Drag Zone */}
      <div
        ref={lookAreaRef}
        className="absolute top-0 right-0 w-2/3 h-full pointer-events-auto"
        onTouchStart={handleLookTouchStart}
        onTouchMove={handleLookTouchMove}
        onTouchEnd={handleLookTouchEnd}
        onTouchCancel={handleLookTouchEnd}
      />

      {/* Crosshair Center & Mining Progress Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex flex-col items-center justify-center">
          {/* Tool requirement warning banner if player lacks required pickaxe tier */}
          {isMining && requiredToolMet === false && (
            <div className="absolute -top-14 whitespace-nowrap bg-red-950/95 border border-red-500 text-red-200 text-[10px] font-bold px-2.5 py-1 rounded shadow-lg animate-pulse flex items-center gap-1">
              <span>⚠️ Doğru Kazma Gerekir (Eşya Düşmez)</span>
            </div>
          )}

          {/* Block Name & Progress Percentage */}
          {isMining && miningBlockType && (
            <div className="absolute -top-7 whitespace-nowrap bg-black/85 border border-white/20 text-white text-[10px] font-pixel px-2 py-0.5 rounded shadow flex items-center gap-1">
              <span>{BLOCK_DEFS[miningBlockType]?.nameTr}</span>
              <span className={requiredToolMet === false ? 'text-red-400' : 'text-amber-400'}>
                %{Math.min(100, Math.round((miningProgress || 0) * 100))}
              </span>
            </div>
          )}

          {/* Radial / Circular mining crack ring */}
          <div className="relative w-9 h-9 flex items-center justify-center">
            {isMining && (
              <svg className="absolute inset-0 w-9 h-9 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  className="stroke-neutral-800/80"
                  strokeWidth="3"
                  fill="none"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  className={requiredToolMet === false ? 'stroke-red-500' : 'stroke-amber-400'}
                  strokeWidth="3"
                  strokeDasharray={87.96}
                  strokeDashoffset={87.96 * (1 - (miningProgress || 0))}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            )}

            {/* Crosshair marks */}
            <div className="absolute w-4 h-[2px] bg-white/80 shadow-[0_0_2px_#000]" />
            <div className="absolute h-4 w-[2px] bg-white/80 shadow-[0_0_2px_#000]" />
            <div className="w-1 h-1 bg-black/60 rounded-full" />
          </div>
        </div>
      </div>

      {/* Bottom-Left: Virtual Joystick & Sprint */}
      <div className="absolute bottom-6 left-6 flex flex-col items-center gap-3 pointer-events-auto">
        {/* Sprint button */}
        <button
          onClick={toggleSprint}
          className={`px-3 py-1 text-xs font-bold uppercase rounded border transition-all ${
            isSprinting
              ? 'bg-amber-500 text-black border-amber-300 scale-105'
              : 'bg-black/50 text-white/80 border-white/20'
          }`}
        >
          {isSprinting ? '⚡ Koşu Aktif' : 'Koş'}
        </button>

        {/* Joystick Base */}
        <div
          ref={joystickContainerRef}
          onTouchStart={handleJoystickTouchStart}
          onTouchMove={handleJoystickTouchMove}
          onTouchEnd={handleJoystickTouchEnd}
          onTouchCancel={handleJoystickTouchEnd}
          className={`relative w-28 h-28 rounded-full border-2 transition-colors flex items-center justify-center ${
            isJoystickActive
              ? 'bg-white/20 border-white/60 shadow-lg'
              : 'bg-black/40 border-white/30 backdrop-blur-sm'
          }`}
        >
          {/* Inner stick guide lines */}
          <div className="absolute w-full h-[1px] bg-white/10" />
          <div className="absolute h-full w-[1px] bg-white/10" />

          {/* Draggable Knob */}
          <div
            className="w-12 h-12 rounded-full bg-white/80 border-2 border-white shadow-md flex items-center justify-center pointer-events-none"
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              transition: isJoystickActive ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            <div className="w-3 h-3 rounded-full bg-black/40" />
          </div>
        </div>
      </div>

      {/* Bottom-Right: Action Buttons (Mine, Place, Jump, Sneak, Fly) */}
      <div className="absolute bottom-6 right-5 flex flex-col items-end gap-3 pointer-events-auto">
        {/* Top Action Row: Sol El (Offhand Swap), Place/Eat & Mine */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sol El / Off-Hand Quick Swap Button */}
          {onSwapOffhand && (
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                onSwapOffhand();
              }}
              onClick={onSwapOffhand}
              className="w-12 h-12 rounded-full border-2 border-amber-400 bg-neutral-900/80 text-amber-300 flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform"
              title="Sol El Eşyası Değiştir (F)"
            >
              <Shield className="w-5 h-5" />
              <span className="text-[8px] font-pixel font-bold uppercase mt-0.5">Sol El</span>
            </button>
          )}

          {/* Place Block / Eat Food Button */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onPlaceOrEat();
            }}
            onClick={onPlaceOrEat}
            className={`w-14 h-14 rounded-full border-2 text-white flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform ${
              BLOCK_DEFS[selectedBlock]?.isFood
                ? 'bg-amber-600/95 border-amber-300 active:bg-amber-700'
                : 'bg-emerald-600/90 border-emerald-300 active:bg-emerald-700'
            }`}
            title={BLOCK_DEFS[selectedBlock]?.isFood ? 'Yiyecek Ye' : 'Blok Yerleştir'}
          >
            {BLOCK_DEFS[selectedBlock]?.isFood ? (
              <>
                <Utensils className="w-6 h-6 stroke-[2.2]" />
                <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">Ye</span>
              </>
            ) : (
              <>
                <SquarePlus className="w-6 h-6 stroke-[2.2]" />
                <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">Koy</span>
              </>
            )}
          </button>

          {/* Mine / Attack Button with Hold-to-Mine and Progress Display */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              if (engine?.attackMob()) return;
              if (onStartMining) onStartMining();
              else engine?.startMining();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              if (onStopMining) onStopMining();
              else engine?.stopMining();
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              if (onStopMining) onStopMining();
              else engine?.stopMining();
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              if (engine?.attackMob()) return;
              if (onStartMining) onStartMining();
              else engine?.startMining();
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              if (onStopMining) onStopMining();
              else engine?.stopMining();
            }}
            onMouseLeave={() => {
              if (onStopMining) onStopMining();
              else engine?.stopMining();
            }}
            className={`w-14 h-14 rounded-full border-2 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all select-none ${
              isMining
                ? 'bg-red-700 border-amber-300 scale-95 shadow-[0_0_12px_rgba(239,68,68,0.7)]'
                : 'bg-red-600/90 border-red-300 active:bg-red-700'
            }`}
            title="Kır / Maden Kaz (Basılı Tut)"
          >
            <Pickaxe className="w-6 h-6 stroke-[2.2]" />
            <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
              {isMining ? `${Math.round((miningProgress || 0) * 100)}%` : 'Kır'}
            </span>
          </button>
        </div>

        {/* Bottom Action Row: Jump, Sneak, Fly */}
        <div className="flex items-center gap-3">
          {/* Fly Toggle (Creative mode) */}
          {engine?.player.gameMode === 'creative' && (
            <button
              onClick={handleToggleFly}
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg active:scale-95 transition-all ${
                isFlying
                  ? 'bg-amber-500 text-black border-amber-200'
                  : 'bg-black/50 text-white/80 border-white/20'
              }`}
              title="Uçma Modu"
            >
              <Feather className="w-5 h-5" />
            </button>
          )}

          {/* Sneak / Fly Down */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              engine?.sneakDown();
            }}
            onClick={() => engine?.sneakDown()}
            className="w-12 h-12 rounded-full bg-neutral-800/80 border-2 border-neutral-600 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            title="Eğil / İn"
          >
            <ArrowDown className="w-5 h-5" />
          </button>

          {/* Jump / Fly Up */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              engine?.jump();
            }}
            onClick={() => engine?.jump()}
            className="w-14 h-14 rounded-full bg-blue-600/90 border-2 border-blue-300 text-white flex items-center justify-center shadow-xl active:scale-90 transition-transform"
            title="Zıpla / Yüksel"
          >
            <ArrowUp className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
