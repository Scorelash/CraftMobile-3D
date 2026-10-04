import React, { useState, useEffect } from 'react';
import { VoxelGameEngine } from '../game/engine';
import {
  Cloud,
  Settings,
  Sun,
  Moon,
  Heart,
  Drumstick,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

interface GameHUDProps {
  engine: VoxelGameEngine | null;
  onOpenDrive: () => void;
  onOpenSettings: () => void;
  onOpenInventory: () => void;
  notification: string | null;
  onRespawn: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  engine,
  onOpenDrive,
  onOpenSettings,
  onOpenInventory,
  notification,
  onRespawn,
}) => {
  const [coords, setCoords] = useState({ x: 0, y: 0, z: 0 });
  const [timePhase, setTimePhase] = useState<'dawn' | 'day' | 'sunset' | 'night'>('day');
  const [nightFactor, setNightFactor] = useState(0);
  const [isHoldingLight, setIsHoldingLight] = useState(false);
  const [gameMode, setGameMode] = useState<'creative' | 'survival'>('creative');
  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [isDead, setIsDead] = useState(false);
  const [isHurt, setIsHurt] = useState(false);
  const [fps, setFps] = useState(60);

  // Poll player coordinates, time, survival stats and FPS directly from engine
  useEffect(() => {
    const interval = setInterval(() => {
      if (engine) {
        setCoords({
          x: Math.round(engine.player.position.x),
          y: Math.round(engine.player.position.y),
          z: Math.round(engine.player.position.z),
        });

        setGameMode(engine.player.gameMode);
        setHealth(Math.round(engine.player.health));
        setHunger(Math.round(engine.player.hunger));
        setIsDead(engine.player.isDead);
        setIsHurt(engine.isHurtFlashing);
        setTimePhase(engine.timePhase);
        setNightFactor(engine.nightFactor);
        setIsHoldingLight(engine.isHoldingLight);
        setFps(engine.currentFPS);
      }
    }, 150);

    return () => {
      clearInterval(interval);
    };
  }, [engine]);

  // Cycle to next time phase when tapping center clock
  const handleCycleTime = () => {
    if (!engine) return;
    if (timePhase === 'dawn') engine.setTimeOfDay(0.25);
    else if (timePhase === 'day') engine.setTimeOfDay(0.50);
    else if (timePhase === 'sunset') engine.setTimeOfDay(0.75);
    else engine.setTimeOfDay(0.00);
  };

  // Compute heart states (10 hearts total, 2 hp each)
  const renderHearts = () => {
    return Array.from({ length: 10 }).map((_, i) => {
      const heartValue = (i + 1) * 2;
      const isFull = health >= heartValue;
      const isHalf = health === heartValue - 1;
      const isCritical = health <= 6;

      return (
        <div
          key={i}
          className={`relative transition-transform ${
            isCritical ? 'animate-bounce' : ''
          }`}
          style={{ animationDuration: '0.8s' }}
        >
          {/* Background empty heart */}
          <Heart className="w-4 h-4 fill-black/60 text-neutral-800 drop-shadow" />
          {/* Foreground active heart */}
          {isFull ? (
            <Heart className="absolute inset-0 w-4 h-4 fill-red-500 text-red-700 drop-shadow" />
          ) : isHalf ? (
            <div className="absolute inset-0 w-2 overflow-hidden">
              <Heart className="w-4 h-4 fill-red-500 text-red-700 drop-shadow" />
            </div>
          ) : null}
        </div>
      );
    });
  };

  // Compute drumstick states (10 drumsticks total, 2 hunger each)
  const renderDrumsticks = () => {
    return Array.from({ length: 10 }).map((_, i) => {
      const drumstickValue = (i + 1) * 2;
      const isFull = hunger >= drumstickValue;
      const isHalf = hunger === drumstickValue - 1;
      const isStarving = hunger <= 4;

      return (
        <div
          key={i}
          className={`relative transition-transform ${
            isStarving ? 'animate-bounce' : ''
          }`}
          style={{ animationDuration: '1.2s' }}
        >
          {/* Empty drumstick background */}
          <Drumstick className="w-4 h-4 fill-black/60 text-neutral-800 drop-shadow" />
          {/* Foreground active drumstick */}
          {isFull ? (
            <Drumstick className="absolute inset-0 w-4 h-4 fill-amber-600 text-amber-900 drop-shadow" />
          ) : isHalf ? (
            <div className="absolute inset-0 w-2 overflow-hidden">
              <Drumstick className="w-4 h-4 fill-amber-600 text-amber-900 drop-shadow" />
            </div>
          ) : null}
        </div>
      );
    });
  };

  return (
    <>
      {/* Dynamic Night Time Low-Light Darkness Filter */}
      {nightFactor > 0.05 && (
        <div
          className="fixed inset-0 pointer-events-none z-10 transition-all duration-700 ease-out"
          style={{
            opacity: nightFactor,
            background: isHoldingLight
              ? 'radial-gradient(circle at 50% 65%, rgba(255, 175, 75, 0.09) 0%, rgba(220, 130, 40, 0.04) 28%, rgba(4, 9, 24, 0.58) 55%, rgba(1, 3, 10, 0.94) 100%)'
              : 'radial-gradient(circle at 50% 50%, rgba(4, 9, 24, 0.42) 0%, rgba(2, 5, 16, 0.78) 60%, rgba(1, 2, 8, 0.96) 100%)',
            backdropFilter: `brightness(${Math.max(0.65, 1 - nightFactor * 0.32)}) contrast(${1 + nightFactor * 0.12})`,
          }}
        >
          {/* Subtle torch aura pulse if holding light */}
          {isHoldingLight && (
            <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent animate-pulse" />
          )}
        </div>
      )}

      {/* Hurt Flash Vignette */}
      {isHurt && (
        <div className="fixed inset-0 pointer-events-none z-40 bg-red-600/25 border-8 border-red-600/70 transition-opacity" />
      )}

      {/* Main HUD overlay */}
      <div className="absolute inset-0 pointer-events-none select-none z-30 overflow-hidden">
        {/* Top Bar Navigation */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
          {/* Left Actions */}
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
            {/* Google Drive Cloud Button */}
            <button
              onClick={onOpenDrive}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-transform active:scale-95 shadow-md"
              title="Google Drive Dünyaları"
            >
              <Cloud className="w-4 h-4 text-blue-200" />
              <span className="hidden sm:inline">Google Drive</span>
            </button>

            {/* Quick Structures Button */}
            <button
              onClick={onOpenInventory}
              className="p-1.5 bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg transition-transform active:scale-95"
              title="Envanter & Üretim"
            >
              <Sparkles className="w-4 h-4 text-purple-200" />
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-transform active:scale-95"
              title="Ayarlar"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Quick 30 / 60 FPS Toggle Badge */}
            <button
              onClick={() => {
                if (engine) {
                  const nextFps = engine.targetFPS === 30 ? 60 : 30;
                  engine.setTargetFPS(nextFps);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 bg-neutral-900/90 hover:bg-neutral-800 text-emerald-400 rounded-lg text-xs font-mono font-bold border border-emerald-500/30 transition-transform active:scale-95 cursor-pointer"
              title="FPS Kilidini Değiştir (30 FPS Kasma Önleme / 60 FPS)"
            >
              <span className="text-[10px] text-neutral-400">FPS:</span>
              <span className="text-emerald-400">{fps}</span>
              {engine?.targetFPS === 30 && (
                <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1 rounded border border-emerald-500/40">30</span>
              )}
            </button>
          </div>

          {/* Center: Coordinates & Interactive Time of Day */}
          <button
            onClick={handleCycleTime}
            className="flex items-center gap-2 bg-black/60 hover:bg-black/75 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 text-white shadow-lg active:scale-95 transition-all cursor-pointer"
            title="Dokun: Zamanı İlerlet (Gündoğumu, Öğlen, Gün Batımı, Gece)"
          >
            {/* Time icon & Phase */}
            {timePhase === 'night' ? (
              <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
            ) : (
              <Sun
                className={`w-4 h-4 ${
                  timePhase === 'sunset'
                    ? 'text-orange-400'
                    : timePhase === 'dawn'
                    ? 'text-amber-400'
                    : 'text-yellow-300'
                } shrink-0`}
              />
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-pixel text-amber-300 uppercase">
                {timePhase === 'dawn'
                  ? 'Gündoğumu'
                  : timePhase === 'day'
                  ? 'Gündüz'
                  : timePhase === 'sunset'
                  ? 'Gün Batımı'
                  : 'Gece'}
              </span>
              <span className="text-neutral-500 text-[10px]">|</span>
              <span className="text-[10px] font-pixel text-neutral-300">
                X:{coords.x} Y:{coords.y} Z:{coords.z}
              </span>
            </div>
          </button>

          {/* Right: Mode & FPS */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 text-white shadow-lg">
            <span
              className={`text-[9px] font-pixel px-1.5 py-0.5 rounded ${
                gameMode === 'creative'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  : 'bg-red-500/30 text-red-300 border border-red-500/40'
              }`}
            >
              {gameMode === 'creative' ? 'YARATICI' : 'HAYATTA KALMA'}
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {fps} FPS
            </span>
          </div>
        </div>

        {/* Survival Health (Can) & Hunger (Açlık) Bars */}
        {gameMode === 'survival' && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center justify-between w-80 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-xl border border-white/15 pointer-events-none shadow-xl">
            {/* 10 Health Hearts (0-20 HP) */}
            <div className="flex items-center gap-1">
              {renderHearts()}
            </div>

            {/* 10 Hunger Drumsticks (0-20 Hunger) */}
            <div className="flex items-center gap-1">
              {renderDrumsticks()}
            </div>
          </div>
        )}

        {/* Toast Notification Banner */}
        {notification && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-neutral-900/95 border-2 border-amber-500/80 text-white rounded-lg shadow-2xl text-xs font-bold font-pixel tracking-wide flex items-center gap-2 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            {notification}
          </div>
        )}
      </div>

      {/* Full-Screen Death / Respawn Overlay */}
      {isDead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none">
          <div className="w-full max-w-sm bg-neutral-900 border-2 border-red-600 rounded-2xl p-6 shadow-2xl text-white text-center animate-scale-up">
            <h2 className="text-3xl font-pixel text-red-500 font-extrabold mb-2 tracking-wider">
              ÖLDÜN!
            </h2>
            <p className="text-xs text-neutral-300 mb-6 leading-relaxed">
              Sağlığın tükendi. Eşyaların korundu ve hayata dönmeye hazırsın!
            </p>

            <button
              onClick={onRespawn}
              className="w-full py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-pixel text-sm rounded-xl shadow-lg border border-red-400 flex items-center justify-center gap-2 transition-transform"
            >
              <RotateCcw className="w-5 h-5" />
              YENİDEN DOĞ
            </button>
          </div>
        </div>
      )}
    </>
  );
};
