import React, { useState } from 'react';
import { VoxelGameEngine } from '../game/engine';
import { sound } from '../game/audio';
import {
  X,
  Volume2,
  VolumeX,
  Music,
  Compass,
  Sliders,
  RotateCcw,
  Sun,
  Shield,
  Zap,
  Gauge,
  Monitor,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: VoxelGameEngine | null;
  touchSensitivity: number;
  onUpdateSensitivity: (val: number) => void;
  onGenerateNewWorld: (seed?: number) => void;
  onNotify: (msg: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  engine,
  touchSensitivity,
  onUpdateSensitivity,
  onGenerateNewWorld,
  onNotify,
}) => {
  const [sfxOn, setSfxOn] = useState(sound.sfxEnabled);
  const [musicOn, setMusicOn] = useState(sound.musicEnabled);
  const [volume, setVolume] = useState(sound.volume);
  const [fov, setFov] = useState(engine?.camera.fov || 70);
  const [targetFps, setTargetFps] = useState(engine?.targetFPS ?? 30);
  const [renderDist, setRenderDist] = useState(engine?.renderDistanceChunks ?? 4);
  const [gameMode, setGameMode] = useState<'creative' | 'survival'>(
    engine?.player.gameMode || 'creative'
  );
  const [customSeed, setCustomSeed] = useState('');

  if (!isOpen) return null;

  const handleFpsChange = (fps: number) => {
    setTargetFps(fps);
    if (engine) {
      engine.setTargetFPS(fps);
      onNotify(
        fps === 30
          ? '🚀 30 FPS Kasma Önleme Modu Aktif!'
          : fps === 60
          ? '⚡ 60 FPS Akıcı Mod Aktif'
          : '🔥 Limitsiz FPS Modu Aktif'
      );
    }
  };

  const handleRenderDistChange = (dist: number) => {
    setRenderDist(dist);
    if (engine) {
      engine.setRenderDistance(dist);
      onNotify(`Görüş mesafesi: ${dist} Chunk (${dist * 16} blok)`);
    }
  };

  const handleToggleSfx = () => {
    sound.sfxEnabled = !sfxOn;
    setSfxOn(!sfxOn);
  };

  const handleToggleMusic = () => {
    sound.musicEnabled = !musicOn;
    setMusicOn(!musicOn);
    if (!musicOn) {
      sound.startAmbientMusic();
    } else {
      sound.stopAmbientMusic();
    }
  };

  const handleVolumeChange = (v: number) => {
    sound.volume = v;
    setVolume(v);
  };

  const handleFovChange = (val: number) => {
    setFov(val);
    if (engine) {
      engine.camera.fov = val;
      engine.camera.updateProjectionMatrix();
    }
  };

  const handleModeChange = (mode: 'creative' | 'survival') => {
    setGameMode(mode);
    if (engine) {
      engine.player.gameMode = mode;
      if (mode === 'survival') {
        engine.player.isFlying = false;
      }
      onNotify(
        mode === 'creative'
          ? 'Yaratıcı Mod aktif (Uçma & Sınırsız blok)'
          : 'Hayatta Kalma Modu aktif (Can & Açlık barı)'
      );
    }
  };

  const handleCreateNewWorld = () => {
    const seed = customSeed.trim()
      ? parseInt(customSeed.replace(/\D/g, ''), 10) || Math.floor(Math.random() * 100000)
      : Math.floor(Math.random() * 100000);
    onGenerateNewWorld(seed);
    onNotify(`Yeni dünya oluşturuldu! (Seed: ${seed})`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 select-none">
      <div className="w-full max-w-md max-h-[90vh] bg-neutral-900 border-2 border-neutral-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-white animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-800 border-b border-neutral-700">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <span className="font-pixel text-xs text-white">OYUN AYARLARI</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center text-neutral-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Performance & FPS Optimization Card */}
          <div className="bg-gradient-to-br from-emerald-950/50 to-neutral-850 p-3 rounded-lg border border-emerald-500/30 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-emerald-400" />
                FPS & Kasma Önleme Modu
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-neutral-400 font-pixel">Canlı:</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-black/60 border border-emerald-500/40 rounded text-emerald-300">
                  {engine ? engine.currentFPS : 30} FPS
                </span>
              </div>
            </div>

            {/* Target FPS Selector */}
            <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
              <button
                onClick={() => handleFpsChange(30)}
                className={`py-2 px-1 rounded flex flex-col items-center gap-0.5 border transition-all cursor-pointer ${
                  targetFps === 30
                    ? 'bg-emerald-600 text-white border-emerald-300 shadow-md ring-1 ring-emerald-400'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                <span className="font-pixel text-xs text-white">30 FPS</span>
                <span className="text-[10px] text-emerald-200">🚀 Sıfır Kasma</span>
              </button>

              <button
                onClick={() => handleFpsChange(60)}
                className={`py-2 px-1 rounded flex flex-col items-center gap-0.5 border transition-all cursor-pointer ${
                  targetFps === 60
                    ? 'bg-emerald-600 text-white border-emerald-300 shadow-md ring-1 ring-emerald-400'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                <span className="font-pixel text-xs text-white">60 FPS</span>
                <span className="text-[10px] text-neutral-300">Akıcı</span>
              </button>

              <button
                onClick={() => handleFpsChange(0)}
                className={`py-2 px-1 rounded flex flex-col items-center gap-0.5 border transition-all cursor-pointer ${
                  targetFps === 0
                    ? 'bg-emerald-600 text-white border-emerald-300 shadow-md ring-1 ring-emerald-400'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                <span className="font-pixel text-xs text-white">Limitsiz</span>
                <span className="text-[10px] text-neutral-400">Serbest</span>
              </button>
            </div>

            {/* Chunk Render Distance */}
            <div className="space-y-1.5 pt-1 border-t border-emerald-500/20">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-neutral-300 flex items-center gap-1">
                  <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                  Görüş Mesafesi (Chunk)
                </span>
                <span className="text-emerald-400 font-mono">
                  {renderDist} Chunk ({renderDist * 16} Blok)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                <button
                  onClick={() => handleRenderDistChange(3)}
                  className={`py-1.5 rounded border transition-all cursor-pointer ${
                    renderDist === 3
                      ? 'bg-emerald-700 text-white border-emerald-300 shadow'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                  }`}
                >
                  Kısa (3 Chunk)
                </button>
                <button
                  onClick={() => handleRenderDistChange(4)}
                  className={`py-1.5 rounded border transition-all cursor-pointer ${
                    renderDist === 4
                      ? 'bg-emerald-700 text-white border-emerald-300 shadow'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                  }`}
                >
                  Dengeli (4 Chunk)
                </button>
                <button
                  onClick={() => handleRenderDistChange(6)}
                  className={`py-1.5 rounded border transition-all cursor-pointer ${
                    renderDist === 6
                      ? 'bg-emerald-700 text-white border-emerald-300 shadow'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                  }`}
                >
                  Uzak (6 Chunk)
                </button>
              </div>
            </div>
          </div>

          {/* Game Mode */}
          <div className="bg-neutral-800/80 p-3 rounded-lg border border-neutral-700 space-y-2">
            <label className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-400" />
              Oyun Modu
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleModeChange('creative')}
                className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  gameMode === 'creative'
                    ? 'bg-amber-500 text-black border-amber-300 shadow'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4" />
                Yaratıcı (Creative)
              </button>
              <button
                onClick={() => handleModeChange('survival')}
                className={`py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                  gameMode === 'survival'
                    ? 'bg-red-600 text-white border-red-400 shadow'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4" />
                Hayatta Kalma
              </button>
            </div>
          </div>

          {/* Touch Sensitivity */}
          <div className="bg-neutral-800/80 p-3 rounded-lg border border-neutral-700 space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-neutral-300">Dokunmatik Bakış Hassasiyeti</span>
              <span className="text-amber-400">{touchSensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={touchSensitivity}
              onChange={(e) => onUpdateSensitivity(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Field of View (FOV) */}
          <div className="bg-neutral-800/80 p-3 rounded-lg border border-neutral-700 space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-neutral-300">Görüş Açısı (FOV)</span>
              <span className="text-amber-400">{fov}°</span>
            </div>
            <input
              type="range"
              min="60"
              max="95"
              step="1"
              value={fov}
              onChange={(e) => handleFovChange(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Time & Day-Night Cycle Control */}
          <div className="bg-neutral-800/80 p-3 rounded-lg border border-neutral-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                Zaman ve Gün Döngüsü
              </label>
              <span className="text-[11px] font-pixel text-amber-300">
                {engine?.timePhase === 'dawn'
                  ? '🌅 Gündoğumu'
                  : engine?.timePhase === 'day'
                  ? '☀️ Öğlen'
                  : engine?.timePhase === 'sunset'
                  ? '🌇 Gün Batımı'
                  : '🌙 Gece'}
              </span>
            </div>

            {/* Quick Time Presets */}
            <div className="grid grid-cols-4 gap-1.5 text-[11px] font-bold">
              <button
                onClick={() => {
                  engine?.setTimeOfDay(0.0);
                  onNotify('🌅 Gündoğumu ayarlandı!');
                }}
                className="py-1.5 px-1 bg-neutral-900 hover:bg-neutral-750 text-amber-300 border border-neutral-700 rounded flex flex-col items-center gap-0.5 active:scale-95 transition-all"
              >
                <span>🌅</span>
                <span>Doğum</span>
              </button>
              <button
                onClick={() => {
                  engine?.setTimeOfDay(0.25);
                  onNotify('☀️ Öğlen / Gündüz ayarlandı!');
                }}
                className="py-1.5 px-1 bg-neutral-900 hover:bg-neutral-750 text-yellow-300 border border-neutral-700 rounded flex flex-col items-center gap-0.5 active:scale-95 transition-all"
              >
                <span>☀️</span>
                <span>Öğlen</span>
              </button>
              <button
                onClick={() => {
                  engine?.setTimeOfDay(0.50);
                  onNotify('🌇 Gün batımı ayarlandı!');
                }}
                className="py-1.5 px-1 bg-neutral-900 hover:bg-neutral-750 text-orange-400 border border-neutral-700 rounded flex flex-col items-center gap-0.5 active:scale-95 transition-all"
              >
                <span>🌇</span>
                <span>Batım</span>
              </button>
              <button
                onClick={() => {
                  engine?.setTimeOfDay(0.75);
                  onNotify('🌙 Gece yarısı ayarlandı!');
                }}
                className="py-1.5 px-1 bg-neutral-900 hover:bg-neutral-750 text-indigo-300 border border-neutral-700 rounded flex flex-col items-center gap-0.5 active:scale-95 transition-all"
              >
                <span>🌙</span>
                <span>Gece</span>
              </button>
            </div>

            {/* Time Speed */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Zaman Akış Hızı</span>
                <span className="text-amber-400 font-mono">
                  {engine ? `${(engine.daySpeed * 3333).toFixed(1)}x` : '1.0x'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.0018"
                step="0.0001"
                defaultValue={engine?.daySpeed || 0.0003}
                onChange={(e) => {
                  if (engine) {
                    engine.daySpeed = parseFloat(e.target.value);
                  }
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                <span>Durdur</span>
                <span>Normal</span>
                <span>Hızlı</span>
                <span>Süper Hızlı</span>
              </div>
            </div>
          </div>

          {/* Audio Controls */}
          <div className="bg-neutral-800/80 p-3 rounded-lg border border-neutral-700 space-y-3">
            <label className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-amber-400" />
              Ses ve Müzik
            </label>

            {/* Master Volume */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Ana Ses Seviyesi</span>
                <span className="text-amber-400">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleToggleSfx}
                className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                  sfxOn
                    ? 'bg-neutral-700 border-neutral-500 text-white'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                }`}
              >
                {sfxOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
                Efekt Sesleri
              </button>

              <button
                onClick={handleToggleMusic}
                className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                  musicOn
                    ? 'bg-neutral-700 border-neutral-500 text-white'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                }`}
              >
                <Music className={`w-4 h-4 ${musicOn ? 'text-amber-400' : ''}`} />
                Ortam Müziği
              </button>
            </div>
          </div>

          {/* Generate New Random World */}
          <div className="bg-neutral-800/80 p-3 rounded-lg border border-neutral-700 space-y-2">
            <label className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              Yeni Dünya Üret
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Rastgele Seed (İsteğe bağlı)"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleCreateNewWorld}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded transition-colors whitespace-nowrap"
              >
                Dünya Oluştur
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-bold"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};
